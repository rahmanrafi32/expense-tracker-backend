import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Loan, LoanDirection, LoanRepayment, Prisma } from '@prisma/client';
import dayjs from 'dayjs';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AllocationService } from '../allocation/allocation.service';
import {
  CreateLoanDto,
  LoanPaymentDto,
  LoanQueryDto,
  LoanStatus,
  UpdateLoanDto,
} from './dto/loan.dto';

type LoanWithRepayments = Loan & { repayments: LoanRepayment[] };

export function loanProgress(loan: LoanWithRepayments) {
  const repaidAmount = loan.repayments.reduce(
    (sum, payment) => sum.plus(payment.amount),
    new Prisma.Decimal(0),
  );
  const outstandingAmount = loan.principal.minus(repaidAmount);
  const status = outstandingAmount.isZero()
    ? LoanStatus.SETTLED
    : repaidAmount.isZero()
      ? LoanStatus.OPEN
      : LoanStatus.PARTIALLY_REPAID;
  const today = dayjs().format('YYYY-MM-DD');
  const due = loan.expectedPayoffDate.toISOString().slice(0, 10);
  return {
    ...loan,
    repaidAmount,
    outstandingAmount,
    status,
    isDueToday: outstandingAmount.gt(0) && due === today,
    isOverdue: outstandingAmount.gt(0) && due < today,
  };
}

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly allocation: AllocationService,
  ) {}

  private date(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException('Invalid calendar date');
    return date;
  }

  private actualDate(value: string) {
    const date = this.date(value);
    if (value > dayjs().format('YYYY-MM-DD'))
      throw new BadRequestException('Actual payments cannot be future dated');
    return date;
  }

  private async book(
    tx: Prisma.TransactionClient,
    userId: string,
    bookId: string,
    lock = false,
  ) {
    if (lock)
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "Book" WHERE "id" = ${bookId} AND "userId" = ${userId} FOR NO KEY UPDATE`,
      );
    const book = await tx.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new NotFoundException('Book not found');
    return book;
  }

  private async loan(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    lock = false,
  ) {
    const found = await tx.loan.findFirst({
      where: { id, book: { userId } },
      select: { bookId: true },
    });
    if (!found) throw new NotFoundException('Loan not found');
    await this.book(tx, userId, found.bookId, lock);
    const loan = await tx.loan.findFirst({
      where: { id, book: { userId } },
      include: { repayments: { orderBy: [{ date: 'desc' }, { id: 'desc' }] } },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  private async post(
    tx: Prisma.TransactionClient,
    userId: string,
    loan: Loan,
    dto: LoanPaymentDto,
    incoming: boolean,
  ) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0))
      throw new BadRequestException('Amount must be greater than zero');
    const date = this.actualDate(dto.date);
    if (date < loan.date)
      throw new BadRequestException('Payment cannot precede the loan date');
    const method = await tx.paymentMethod.findFirst({
      where: {
        id: dto.paymentMethodId,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });
    if (!method) throw new BadRequestException('Payment method not found');
    const transaction = await tx.transaction.create({
      data: {
        bookId: loan.bookId,
        loanId: loan.id,
        type: incoming ? 'INCOME' : 'EXPENSE',
        amount,
        date,
        paymentMethodId: method.id,
        remark: dto.notes ?? `Loan: ${loan.personName}`,
      },
    });
    if (!incoming)
      await this.allocation.consumeUnallocated(
        tx,
        loan.bookId,
        amount,
        transaction.id,
      );
    await this.balance.updateBookBalance(tx, loan.bookId);
    return transaction;
  }

  async create(userId: string, dto: CreateLoanDto) {
    const date = this.actualDate(dto.date);
    const expectedPayoffDate = this.date(dto.expectedPayoffDate);
    if (expectedPayoffDate < date)
      throw new BadRequestException(
        'Expected payoff date cannot precede the loan date',
      );
    const principal = new Prisma.Decimal(dto.amount);
    if (principal.lte(0))
      throw new BadRequestException('Amount must be greater than zero');
    return this.prisma.$transaction(async (tx) => {
      await this.book(tx, userId, dto.bookId, true);
      const loan = await tx.loan.create({
        data: {
          bookId: dto.bookId,
          direction: dto.direction,
          personName: dto.personName,
          principal,
          date,
          expectedPayoffDate,
          notes: dto.notes,
        },
      });
      await this.post(
        tx,
        userId,
        loan,
        dto,
        loan.direction === LoanDirection.BORROWED,
      );
      return loanProgress({ ...loan, repayments: [] });
    });
  }

  async findOne(userId: string, id: string) {
    return loanProgress(await this.loan(this.prisma, userId, id));
  }

  async findAll(userId: string, dto: LoanQueryDto) {
    await this.book(this.prisma, userId, dto.bookId);
    const loans = await this.prisma.loan.findMany({
      where: {
        bookId: dto.bookId,
        direction: dto.direction,
        ...(dto.search
          ? { personName: { contains: dto.search, mode: 'insensitive' } }
          : {}),
      },
      include: { repayments: true },
      orderBy: [{ expectedPayoffDate: 'asc' }, { id: 'asc' }],
    });
    const filtered = loans
      .map(loanProgress)
      .filter((loan) => !dto.status || loan.status === dto.status);
    return {
      data: filtered.slice(dto.offset, dto.offset + dto.limit),
      total: filtered.length,
      nextOffset:
        dto.offset + dto.limit < filtered.length
          ? dto.offset + dto.limit
          : null,
    };
  }

  async summary(userId: string, bookId: string) {
    await this.book(this.prisma, userId, bookId);
    const loans = await this.prisma.loan.findMany({
      where: { bookId },
      include: { repayments: true },
    });
    const result = {
      outstandingReceivables: new Prisma.Decimal(0),
      outstandingPayables: new Prisma.Decimal(0),
      overdueReceivables: new Prisma.Decimal(0),
      overduePayables: new Prisma.Decimal(0),
    };
    for (const loan of loans.map(loanProgress)) {
      const lent = loan.direction === LoanDirection.LENT;
      const key = lent ? 'outstandingReceivables' : 'outstandingPayables';
      result[key] = result[key].plus(loan.outstandingAmount);
      if (loan.isOverdue) {
        const overdue = lent ? 'overdueReceivables' : 'overduePayables';
        result[overdue] = result[overdue].plus(loan.outstandingAmount);
      }
    }
    return result;
  }

  async update(userId: string, id: string, dto: UpdateLoanDto) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await this.loan(tx, userId, id, true);
      const expectedPayoffDate = dto.expectedPayoffDate
        ? this.date(dto.expectedPayoffDate)
        : undefined;
      if (expectedPayoffDate && expectedPayoffDate < loan.date)
        throw new BadRequestException(
          'Expected payoff date cannot precede the loan date',
        );
      const updated = await tx.loan.update({
        where: { id },
        data: {
          personName: dto.personName,
          notes: dto.notes,
          expectedPayoffDate,
        },
        include: { repayments: true },
      });
      return loanProgress(updated);
    });
  }

  async repay(userId: string, id: string, dto: LoanPaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await this.loan(tx, userId, id, true);
      const amount = new Prisma.Decimal(dto.amount);
      if (amount.lte(0) || amount.gt(loanProgress(loan).outstandingAmount))
        throw new BadRequestException(
          'Repayment must be positive and cannot exceed the outstanding amount',
        );
      const transaction = await this.post(
        tx,
        userId,
        loan,
        dto,
        loan.direction === LoanDirection.LENT,
      );
      await tx.loanRepayment.create({
        data: {
          loanId: id,
          amount,
          date: transaction.date,
          transactionId: transaction.id,
          notes: dto.notes,
        },
      });
      return loanProgress(await this.loan(tx, userId, id));
    });
  }

  private async reverse(tx: Prisma.TransactionClient, transactionId: string) {
    const consumptions = await tx.allocationConsumption.findMany({
      where: { transactionId },
    });
    for (const consumption of consumptions)
      await tx.allocationBatch.update({
        where: { id: consumption.batchId },
        data: { unallocatedAmount: { increment: consumption.amount } },
      });
    await tx.transaction.delete({ where: { id: transactionId } });
  }

  async removeRepayment(userId: string, id: string, repaymentId: string) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await this.loan(tx, userId, id, true);
      const payment = loan.repayments.find(
        (payment) => payment.id === repaymentId,
      );
      if (!payment) throw new NotFoundException('Repayment not found');
      await tx.loanRepayment.delete({ where: { id: repaymentId } });
      await this.reverse(tx, payment.transactionId);
      await this.balance.updateBookBalance(tx, loan.bookId);
      return loanProgress(await this.loan(tx, userId, id));
    });
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const loan = await this.loan(tx, userId, id, true);
      if (loan.repayments.length)
        throw new BadRequestException(
          'Remove repayments before deleting the loan',
        );
      const transactions = await tx.transaction.findMany({
        where: { loanId: id },
      });
      for (const transaction of transactions)
        await this.reverse(tx, transaction.id);
      await tx.loan.delete({ where: { id } });
      await this.balance.updateBookBalance(tx, loan.bookId);
      return { id };
    });
  }
}
