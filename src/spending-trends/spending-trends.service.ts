import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import dayjs from 'dayjs';

@Injectable()
export class SpendingTrendsService {
  constructor(private prisma: PrismaService) {}

  async getSpendingTrend(userId: string, bookId: string, months: number = 3) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
    });

    if (!book) throw new NotFoundException('Book not found');

    const startDate = dayjs()
      .subtract(months, 'month')
      .startOf('month')
      .toDate();
    const endDate = dayjs().startOf('month').toDate();

    const transactions = await this.prisma.transaction.findMany({
      where: {
        bookId,
        type: TransactionType.EXPENSE,
        date: {
          gte: startDate,
          lt: endDate,
        },
        recurringExpenseId: null,
        emergencyFundId: null,
      },
      select: {
        amount: true,
        date: true,
      },
    });

    const monthMap = new Map<string, { total: number; count: number }>();

    for (const tx of transactions) {
      const monthKey = dayjs(tx.date).format('YYYY-MM');
      const existing = monthMap.get(monthKey) ?? { total: 0, count: 0 };

      monthMap.set(monthKey, {
        total: existing.total + new Prisma.Decimal(tx.amount).toNumber(),
        count: existing.count + 1,
      });
    }

    const groupedMonths = Array.from(monthMap.entries())
      .map(([monthKey, data]) => ({
        month: dayjs(`${monthKey}-01`).format('MMM YYYY'),
        monthKey,
        total: Math.round(data.total * 100) / 100,
        transactionCount: data.count,
      }))
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));

    const monthsUsed = groupedMonths.length;
    const averageMonthly =
      monthsUsed > 0
        ? Math.round(
            (groupedMonths.reduce((sum, m) => sum + m.total, 0) / monthsUsed) *
              100,
          ) / 100
        : 0;

    return {
      averageMonthly,
      dailyAverage: Math.round((averageMonthly / 30) * 100) / 100,
      monthsUsed,
      dataAvailability:
        monthsUsed >= months ? 'FULL' : monthsUsed > 0 ? 'PARTIAL' : 'NONE',
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
