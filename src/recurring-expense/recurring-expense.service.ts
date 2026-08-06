import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense';
import {
  ExpenseFrequency,
  ExpenseStatus,
  ReccuringExpenses,
} from '@prisma/client';
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

    let category = await this.prisma.category.findFirst({
      where: {
        name: dto.category,
        OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
      },
    });
    if (!category)
      category = await this.prisma.category.create({
        data: { name: dto.category, userId: book.userId },
      });

    let paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: dto.paymentMethod,
        OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
      },
    });
    if (!paymentMethod)
      paymentMethod = await this.prisma.paymentMethod.create({
        data: { name: dto.paymentMethod, userId: book.userId },
      });

    const created = await this.prisma.reccuringExpenses.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        amount: dto.amount,
        categoryId: category.id,
        paymentMethodId: paymentMethod.id,
        frequency: dto.frequency,
        nextDueDate: dto.nextDueDate,
        status: ExpenseStatus.UNPAID,
      },
      include: {
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    });

    return {
      ...created,
      category: created.category?.name || null,
      paymentMethod: created.paymentMethod?.name || null,
    };
  }

  async findAllByBook(
    bookId: string,
  ): Promise<
    Array<
      ReccuringExpenses & { monthlyEquivalent: number; daysUntilDue: number }
    >
  > {
    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
      orderBy: { nextDueDate: 'asc' },
      include: {
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    });

    const now = dayjs().startOf('day');

    return bills.map((b) => {
      const daysUntil = dayjs(b.nextDueDate).diff(now, 'day');

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
        category: b.category?.name || null,
        paymentMethod: b.paymentMethod?.name || null,
        monthlyEquivalent: Math.round(b.amount / FREQUENCY_MONTHS[b.frequency]),
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

    const data: Prisma.ReccuringExpensesUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.nextDueDate !== undefined) data.nextDueDate = dto.nextDueDate;

    if (dto.category !== undefined) {
      let category = await this.prisma.category.findFirst({
        where: {
          name: dto.category,
          OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
        },
      });
      if (!category)
        category = await this.prisma.category.create({
          data: { name: dto.category, userId: book.userId },
        });
      data.categoryId = category.id;
    }

    if (dto.paymentMethod !== undefined) {
      let paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          name: dto.paymentMethod,
          OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
        },
      });
      if (!paymentMethod)
        paymentMethod = await this.prisma.paymentMethod.create({
          data: { name: dto.paymentMethod, userId: book.userId },
        });
      data.paymentMethodId = paymentMethod.id;
    }

    const updated = await this.prisma.reccuringExpenses.update({
      where: { id },
      data,
      include: {
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    });

    return {
      ...updated,
      category: updated.category?.name || null,
      paymentMethod: updated.paymentMethod?.name || null,
    };
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

      const transactionData = await tx.transaction.create({
        data: {
          bookId: expense.bookId,
          type: TransactionType.EXPENSE,
          amount: expense.amount,
          remark: expense.name,
          date: new Date(),
          categoryId: expense.categoryId,
          recurringExpenseId: id,
        },
      });

      if (expense.categoryId) transactionData.categoryId = expense.categoryId;
      if (expense.paymentMethodId)
        transactionData.paymentMethodId = expense.paymentMethodId;

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
      (sum, b) => sum + Math.round(b.amount / FREQUENCY_MONTHS[b.frequency]),
      0,
    );

    const dueThisMonth = bills.filter((b) => {
      const isUnpaid = b.status !== ExpenseStatus.PAID;
      const isDueThisMonthOrEarlier =
        dayjs(b.nextDueDate).isBefore(endOfMonth) ||
        dayjs(b.nextDueDate).isSame(endOfMonth, 'day');
      return isUnpaid && isDueThisMonthOrEarlier;
    });

    const dueThisMonthAmount = dueThisMonth.reduce((s, b) => s + b.amount, 0);

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

    const currentBalance = book?.bookTotalAmount ?? 0;
    const shortfall = dueThisMonthAmount - currentBalance;
    const hasShortfall = shortfall > 0;

    return {
      monthlyTotal,
      dueThisMonthCount: dueThisMonth.length,
      dueThisMonthAmount: dueThisMonth.reduce((s, b) => s + b.amount, 0),
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
