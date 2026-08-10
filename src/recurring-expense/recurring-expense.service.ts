import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ExpenseFrequency,
  ExpenseStatus,
  Prisma,
  ReccuringExpenses,
} from '@prisma/client';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense';
import dayjs, { Dayjs } from 'dayjs';
import { TransactionType } from '../common';
import { BalanceService } from '../balance/balance.service';

const FREQUENCY_MONTHS: Record<ExpenseFrequency, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  HALF_YEARLY: 6,
  YEARLY: 12,
};

@Injectable()
export class RecurringExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  async create(userId: string, dto: CreateRecurringExpenseDto) {
    const book = await this.prisma.book.findFirst({
      where: { id: dto.bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const decimalAmount = new Prisma.Decimal(dto.amount);

    if (decimalAmount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (decimalAmount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: dto.paymentMethodId,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });

    if (!paymentMethod) {
      throw new BadRequestException('Payment method not found');
    }

    const created = await this.prisma.reccuringExpenses.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        amount: decimalAmount,
        categoryId: category.id,
        paymentMethodId: paymentMethod.id,
        frequency: dto.frequency,
        nextDueDate: dto.nextDueDate,
        status: ExpenseStatus.UNPAID,
      },
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
    });

    return {
      ...created,
      category: created.category?.name || null,
      paymentMethod: created.paymentMethod?.name || null,
    };
  }
  private computeExpenseDisplay(
    bill: {
      amount: Prisma.Decimal;
      frequency: ExpenseFrequency;
      nextDueDate: Date;
      status: ExpenseStatus;
    },
    now: Dayjs,
  ) {
    const daysUntilDue = dayjs(bill.nextDueDate)
      .startOf('day')
      .diff(now, 'day');

    let status: ExpenseStatus;

    if (daysUntilDue < 0) {
      status = ExpenseStatus.OVERDUE;
    } else if (daysUntilDue <= 7) {
      status = ExpenseStatus.UNPAID;
    } else {
      status = bill.status;
    }

    const monthlyEquivalent = new Prisma.Decimal(bill.amount)
      .div(FREQUENCY_MONTHS[bill.frequency])
      .toDecimalPlaces(2);

    return {
      status,
      monthlyEquivalent: monthlyEquivalent.toNumber(),
      daysUntilDue,
    };
  }

  async findAllByBook(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException(`Book ${bookId} not found`);

    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
      orderBy: { nextDueDate: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
    });

    const now = dayjs().startOf('day');

    return bills.map((b) => ({
      id: b.id,
      bookId: b.bookId,
      name: b.name,
      amount: b.amount,
      frequency: b.frequency,
      nextDueDate: b.nextDueDate,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,

      category: b.category,
      paymentMethod: b.paymentMethod,

      ...this.computeExpenseDisplay(b, now),
    }));
  }

  private async getExpenseOrThrow(userId: string, id: string) {
    const expense = await this.prisma.reccuringExpenses.findFirst({
      where: { id, book: { userId } },
      include: { category: { select: { name: true } } },
    });
    if (!expense) throw new NotFoundException(`Bill ${id} not found`);
    return expense;
  }

  async findOne(userId: string, id: string) {
    const expense = await this.getExpenseOrThrow(userId, id);
    const now = dayjs().startOf('day');

    return {
      ...expense,
      category: expense.category?.name || null,
      ...this.computeExpenseDisplay(expense, now),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<any> {
    await this.getExpenseOrThrow(userId, id);

    if (dto.amount !== undefined) {
      const decimalAmount = new Prisma.Decimal(dto.amount);

      if (decimalAmount.isNegative()) {
        throw new BadRequestException('Amount cannot be negative');
      }

      if (decimalAmount.isZero()) {
        throw new BadRequestException('Amount must be greater than zero');
      }
    }

    const data: Prisma.ReccuringExpensesUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.nextDueDate !== undefined)
      data.nextDueDate = new Date(dto.nextDueDate);

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [{ userId }, { isDefault: true, userId: null }],
        },
      });

      if (!category) {
        throw new BadRequestException('Category not found.');
      }

      data.categoryId = category.id;
    }

    if (dto.paymentMethodId !== undefined) {
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: dto.paymentMethodId,
          OR: [{ userId }, { isDefault: true, userId: null }],
        },
      });

      if (!paymentMethod) {
        throw new BadRequestException('Payment method not found.');
      }

      data.paymentMethodId = paymentMethod.id;
    }

    return await this.prisma.reccuringExpenses.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
    });
  }

  async markPaid(userId: string, id: string): Promise<ReccuringExpenses> {
    const expense = await this.getExpenseOrThrow(userId, id);
    const months = FREQUENCY_MONTHS[expense.frequency];
    const nextDueDate = dayjs(expense.nextDueDate).add(months, 'month');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.reccuringExpenses.update({
        where: { id },
        data: {
          status: ExpenseStatus.PAID,
          nextDueDate: nextDueDate.toDate(),
        },
      });

      await tx.transaction.create({
        data: {
          bookId: expense.bookId,
          type: TransactionType.EXPENSE,
          amount: expense.amount,
          remark: expense.name,
          date: new Date(),
          categoryId: expense.categoryId,
          paymentMethodId: expense.paymentMethodId,
          recurringExpenseId: id,
        },
      });

      await this.balanceService.updateBookBalance(tx, expense.bookId);

      return updated;
    });
  }

  async remove(userId: string, id: string): Promise<ReccuringExpenses> {
    await this.getExpenseOrThrow(userId, id);
    return this.prisma.reccuringExpenses.delete({ where: { id } });
  }

  async getSummary(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { bookTotalAmount: true },
    });
    if (!book) throw new NotFoundException(`Book ${bookId} not found`);

    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
    });
    const now = dayjs();
    const endOfMonth = now.endOf('month');

    const monthlyTotal = bills.reduce(
      (sum, b) =>
        sum.plus(
          new Prisma.Decimal(b.amount)
            .div(FREQUENCY_MONTHS[b.frequency])
            .toDecimalPlaces(2),
        ),
      new Prisma.Decimal(0),
    );

    const dueThisMonth = bills.filter((b) => {
      const isUnpaid = b.status !== ExpenseStatus.PAID;
      const isDueThisMonthOrEarlier =
        dayjs(b.nextDueDate).isBefore(endOfMonth) ||
        dayjs(b.nextDueDate).isSame(endOfMonth, 'day');
      return isUnpaid && isDueThisMonthOrEarlier;
    });

    const dueThisMonthAmount = dueThisMonth.reduce(
      (sum, b) => sum.plus(new Prisma.Decimal(b.amount)),
      new Prisma.Decimal(0),
    );

    const nextDue = bills
      .filter((b) => !dayjs(b.nextDueDate).isBefore(now.startOf('day')))
      .sort(
        (a, b) =>
          dayjs(a.nextDueDate).valueOf() - dayjs(b.nextDueDate).valueOf(),
      )[0];

    const currentBalance = new Prisma.Decimal(book.bookTotalAmount ?? 0);
    const shortfallRaw = dueThisMonthAmount.minus(currentBalance);
    const hasShortfall = shortfallRaw.gt(0);
    const shortfall = hasShortfall ? shortfallRaw : new Prisma.Decimal(0);

    return {
      monthlyTotal: monthlyTotal.toFixed(2),
      dueThisMonthCount: dueThisMonth.length,
      dueThisMonthAmount: dueThisMonthAmount.toFixed(2),
      nextDue: nextDue
        ? {
            name: nextDue.name,
            amount: new Prisma.Decimal(nextDue.amount).toFixed(2),
            nextDueDate: nextDue.nextDueDate,
            daysUntil: dayjs(nextDue.nextDueDate).diff(
              now.startOf('day'),
              'day',
            ),
          }
        : null,
      currentBalance: currentBalance.toFixed(2),
      shortfall: shortfall.toFixed(2),
      hasShortfall,
      upcomingPayments: dueThisMonth.map((b) => ({
        id: b.id,
        name: b.name,
        amount: new Prisma.Decimal(b.amount).toFixed(2),
        nextDueDate: b.nextDueDate,
      })),
    };
  }
}
