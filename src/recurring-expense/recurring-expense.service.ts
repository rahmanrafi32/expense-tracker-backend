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

  async create(dto: CreateRecurringExpenseDto): Promise<ReccuringExpenses> {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });
    if (!book) throw new NotFoundException('Book not found');

    return this.prisma.reccuringExpenses.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        amount: dto.amount,
        category: dto.category,
        frequency: dto.frequency,
        nextDueDate: dto.nextDueDate,
        status: ExpenseStatus.UNPAID,
      },
    });
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
    });

    const now = dayjs().startOf('day');
    return bills.map((b) => ({
      ...b,
      monthlyEquivalent: Math.round(b.amount / FREQUENCY_MONTHS[b.frequency]),
      daysUntilDue: dayjs(b.nextDueDate).diff(now, 'day'),
    }));
  }

  async findOne(id: string): Promise<ReccuringExpenses> {
    const expense = await this.prisma.reccuringExpenses.findUnique({
      where: { id },
    });
    if (!expense) throw new NotFoundException(`Bill ${id} not found`);
    return expense;
  }

  async update(
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<ReccuringExpenses> {
    await this.findOne(id);

    const data: Partial<ReccuringExpenses> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.nextDueDate !== undefined) data.nextDueDate = dto.nextDueDate;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.reccuringExpenses.update({ where: { id }, data });
  }

  async markPaid(id: string): Promise<ReccuringExpenses> {
    const expense = await this.findOne(id);
    const months = FREQUENCY_MONTHS[expense.frequency];
    const nextDueDate = dayjs(expense.nextDueDate)
      .add(months, 'month')
      .toDate();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updated = await tx.reccuringExpenses.update({
        where: { id },
        data: { status: ExpenseStatus.PAID, nextDueDate },
      });

      await tx.transaction.create({
        data: {
          bookId: expense.bookId,
          type: TransactionType.EXPENSE,
          amount: expense.amount,
          remark: expense.name,
          date: new Date(),
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

  async getSummary(bookId: string): Promise<{
    monthlyTotal: number;
    dueThisMonthCount: number;
    dueThisMonthAmount: number;
    nextDue: {
      name: string;
      amount: number;
      nextDueDate: Date;
      daysUntil: number;
    } | null;
  }> {
    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
    });
    const now = dayjs();

    const monthlyTotal = bills.reduce(
      (sum, b) => sum + Math.round(b.amount / FREQUENCY_MONTHS[b.frequency]),
      0,
    );

    const dueThisMonth = bills.filter((b) =>
      dayjs(b.nextDueDate).isSame(now, 'month'),
    );

    const nextDue = bills
      .filter((b) => !dayjs(b.nextDueDate).isBefore(now.startOf('day')))
      .sort(
        (a, b) =>
          dayjs(a.nextDueDate).valueOf() - dayjs(b.nextDueDate).valueOf(),
      )[0];

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
    };
  }
}
