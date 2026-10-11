import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import dayjs from 'dayjs';

type TrendMonth = {
  month: string;
  monthKey: string;
  total: number;
  transactionCount: number;
  income: number;
  incomeTransactionCount: number;
};

@Injectable()
export class SpendingTrendsService {
  constructor(private prisma: PrismaService) {}

  async getSpendingTrend(userId: string, bookId: string, months: number = 3) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
    });

    if (!book) throw new NotFoundException('Book not found');

    return this.getSpendingTrendForBook(bookId, months);
  }

  async getSpendingTrendForBook(bookId: string, months: number = 3) {
    const endDate = dayjs().startOf('month');
    const startDate = endDate.subtract(months, 'month');

    const transactions = await this.prisma.transaction.findMany({
      where: {
        bookId,
        date: {
          gte: startDate.toDate(),
          lt: endDate.toDate(),
        },
      },
      select: {
        type: true,
        amount: true,
        date: true,
        recurringExpenseId: true,
        emergencyFundId: true,
      },
    });

    const monthMap = new Map<string, TrendMonth>();

    for (let index = 0; index < months; index += 1) {
      const monthDate = startDate.add(index, 'month');
      const monthKey = monthDate.format('YYYY-MM');

      monthMap.set(monthKey, {
        month: monthDate.format('MMM YYYY'),
        monthKey,
        total: 0,
        transactionCount: 0,
        income: 0,
        incomeTransactionCount: 0,
      });
    }

    for (const tx of transactions) {
      const monthKey = dayjs(tx.date).format('YYYY-MM');
      const existing = monthMap.get(monthKey);
      if (!existing || tx.emergencyFundId) continue;

      const amount = new Prisma.Decimal(tx.amount).toNumber();

      if (tx.type === TransactionType.INCOME) {
        existing.income += amount;
        existing.incomeTransactionCount += 1;
      } else if (
        tx.type === TransactionType.EXPENSE &&
        tx.recurringExpenseId === null
      ) {
        existing.total += amount;
        existing.transactionCount += 1;
      }
    }

    const groupedMonths = Array.from(monthMap.entries())
      .map(([, data]) => ({
        ...data,
        total: Math.round(data.total * 100) / 100,
        income: Math.round(data.income * 100) / 100,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const monthsWithExpense = groupedMonths.filter(
      (month) => month.transactionCount > 0,
    ).length;
    const monthsWithIncome = groupedMonths.filter(
      (month) => month.incomeTransactionCount > 0,
    ).length;
    const monthsUsed = groupedMonths.length;
    const averageMonthly =
      monthsUsed > 0
        ? Math.round(
            (groupedMonths.reduce((sum, m) => sum + m.total, 0) / monthsUsed) *
              100,
          ) / 100
        : 0;
    const averageMonthlyIncome =
      monthsUsed > 0
        ? Math.round(
            (groupedMonths.reduce((sum, m) => sum + m.income, 0) / monthsUsed) *
              100,
          ) / 100
        : 0;
    const monthsWithActivity = groupedMonths.filter(
      (month) => month.transactionCount > 0 || month.incomeTransactionCount > 0,
    ).length;

    return {
      averageMonthly,
      averageMonthlyIncome,
      dailyAverage: Math.round((averageMonthly / 30) * 100) / 100,
      monthsUsed,
      monthsWithExpense,
      monthsWithIncome,
      dataAvailability:
        monthsWithActivity >= months
          ? 'FULL'
          : monthsWithActivity > 0
            ? 'PARTIAL'
            : 'NONE',
      months: groupedMonths,
    };
  }

  async getEffectiveDailyBurnRate(
    userId: string,
    bookId: string,
    daysInMonth: number,
  ): Promise<number> {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { expectedMonthlyExpenses: true, type: true },
    });

    if (!book) throw new NotFoundException('Book not found');

    if (book.type === 'ESCROW') {
      return 0;
    }

    const trend = await this.getSpendingTrend(userId, bookId);

    if (trend.averageMonthly > 0) {
      return trend.averageMonthly / daysInMonth;
    }

    return (
      new Prisma.Decimal(book?.expectedMonthlyExpenses ?? 0).toNumber() /
      daysInMonth
    );
  }
}
