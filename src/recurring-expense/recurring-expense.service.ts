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
import dayjs from 'dayjs';
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

  async create(dto: CreateRecurringExpenseDto) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
      include: { user: true },
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
        OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: dto.paymentMethodId,
        OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
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

  async findAllByBook(bookId: string) {
    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
      orderBy: { nextDueDate: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
      },
    });

    const now = dayjs().startOf('day');

    return bills.map((b) => {
      const daysUntil = dayjs(b.nextDueDate).diff(now, 'day');

      const monthlyEquivalent = new Prisma.Decimal(b.amount)
        .div(FREQUENCY_MONTHS[b.frequency])
        .toNumber();

      let currentStatus: ExpenseStatus;
      if (daysUntil < 0) {
        currentStatus = ExpenseStatus.OVERDUE;
      } else if (daysUntil <= 7) {
        currentStatus = ExpenseStatus.UNPAID;
      } else {
        currentStatus = ExpenseStatus.PAID;
      }

      return {
        ...b,
        status: currentStatus,
        monthlyEquivalent: Math.round(monthlyEquivalent * 100) / 100,
        daysUntilDue: daysUntil,
      };
    });
  }

  async findOne(id: string) {
    const expense = await this.prisma.reccuringExpenses.findUnique({
      where: { id },
      include: { category: { select: { name: true } } },
    });
    if (!expense) throw new NotFoundException(`Bill ${id} not found`);
    return { ...expense, category: expense.category?.name || null };
  }

  async update(id: string, dto: UpdateRecurringExpenseDto): Promise<any> {
    const expense = await this.findOne(id);
    const book = await this.prisma.book.findUnique({
      where: { id: expense.bookId },
      include: { user: true },
    });
    if (!book) throw new NotFoundException('Book not found');

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

          OR: [
            {
              userId: book.userId,
            },
            {
              isDefault: true,
              userId: null,
            },
          ],
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

          OR: [
            {
              userId: book.userId,
            },
            {
              isDefault: true,
              userId: null,
            },
          ],
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

  async markPaid(id: string): Promise<ReccuringExpenses> {
    const expense = await this.findOne(id);
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

  async remove(id: string): Promise<ReccuringExpenses> {
    await this.findOne(id);
    return this.prisma.reccuringExpenses.delete({ where: { id } });
  }

  async getSummary(bookId: string) {
    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
    });
    const now = dayjs();
    const endOfMonth = now.endOf('month');

    const monthlyTotal = bills.reduce(
      (sum, b) =>
        sum +
        Math.round(
          new Prisma.Decimal(b.amount).toNumber() /
            FREQUENCY_MONTHS[b.frequency],
        ),
      0,
    );

    const dueThisMonth = bills.filter((b) => {
      const isUnpaid = b.status !== ExpenseStatus.PAID;
      const isDueThisMonthOrEarlier =
        dayjs(b.nextDueDate).isBefore(endOfMonth) ||
        dayjs(b.nextDueDate).isSame(endOfMonth, 'day');
      return isUnpaid && isDueThisMonthOrEarlier;
    });

    const dueThisMonthAmount = dueThisMonth.reduce(
      (s, b) => s + new Prisma.Decimal(b.amount).toNumber(),
      0,
    );

    const nextDue = bills
      .filter((b) => !dayjs(b.nextDueDate).isBefore(now.startOf('day')))
      .sort(
        (a, b) =>
          dayjs(a.nextDueDate).valueOf() - dayjs(b.nextDueDate).valueOf(),
      )[0];

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { bookTotalAmount: true },
    });

    const currentBalance = new Prisma.Decimal(
      book?.bookTotalAmount ?? 0,
    ).toNumber();
    const shortfall = dueThisMonthAmount - currentBalance;
    const hasShortfall = shortfall > 0;

    return {
      monthlyTotal,
      dueThisMonthCount: dueThisMonth.length,
      dueThisMonthAmount: dueThisMonth.reduce(
        (s, b) => s + new Prisma.Decimal(b.amount).toNumber(),
        0,
      ),
      nextDue: nextDue
        ? {
            name: nextDue.name,
            amount: nextDue.amount,
            nextDueDate: nextDue.nextDueDate,
            daysUntil: dayjs(nextDue.nextDueDate).diff(
              now.startOf('day'),
              'day',
            ),
          }
        : null,
      currentBalance,
      shortfall: hasShortfall ? Math.round(shortfall * 100) / 100 : 0,
      hasShortfall,
      upcomingPayments: dueThisMonth.map((b) => ({
        id: b.id,
        name: b.name,
        amount: b.amount,
        nextDueDate: b.nextDueDate,
      })),
    };
  }
}
