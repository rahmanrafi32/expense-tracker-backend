import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionType } from '@prisma/client';
import dayjs from 'dayjs';
import { MonthlyInsightDto, YearlyInsightDto } from './dto/insights.dto';

@Injectable()
export class InsightsService {
  constructor(private readonly prisma: PrismaService) {}

  // --- REUSABLE HELPER ---
  private getMonthDateRange(month: number, year: number) {
    const startDate = dayjs(`${year}-${month}-01`).startOf('month').toDate();
    const endDate = dayjs(`${year}-${month}-01`).endOf('month').toDate();
    return { startDate, endDate };
  }

  // --- FEATURE 1: Monthly Income vs. Expense Ratio ---
  async getMonthlyOverview(dto: MonthlyInsightDto) {
    const { startDate, endDate } = this.getMonthDateRange(dto.month, dto.year);

    const totals = await this.prisma.transaction.groupBy({
      by: ['type'],
      where: { bookId: dto.bookId, date: { gte: startDate, lte: endDate } },
      _sum: { amount: true },
    });

    const totalIncome =
      totals.find((t) => t.type === TransactionType.INCOME)?._sum.amount ?? 0;
    const totalExpense =
      totals.find((t) => t.type === TransactionType.EXPENSE)?._sum.amount ?? 0;
    const netSavings = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    return {
      totalIncome,
      totalExpense,
      netSavings,
      savingsRate: Math.round(savingsRate * 100) / 100,
    };
  }

  // --- FEATURE 2: Spending by Sector (Category Breakdown) ---
  async getCategoryBreakdown(dto: MonthlyInsightDto) {
    const { startDate, endDate } = this.getMonthDateRange(dto.month, dto.year);

    const groupedExpenses = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        bookId: dto.bookId,
        type: TransactionType.EXPENSE,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (groupedExpenses.length === 0) return [];

    const categoryIds = groupedExpenses
      .map((g) => g.categoryId)
      .filter(Boolean) as string[];
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const top5 = groupedExpenses.slice(0, 5).map((g) => ({
      name: g.categoryId
        ? categoryMap.get(g.categoryId) || 'Uncategorized'
        : 'Uncategorized',
      value: g._sum.amount ?? 0,
    }));

    const otherTotal = groupedExpenses
      .slice(5)
      .reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);
    if (otherTotal > 0) top5.push({ name: 'Other', value: otherTotal });

    return top5;
  }

  // --- FEATURE 3: Yearly Trend (Month-by-Month) ---
  async getYearlyTrend(dto: YearlyInsightDto) {
    const startDate = dayjs(`${dto.year}-01-01`).startOf('year').toDate();
    const endDate = dayjs(`${dto.year}-12-31`).endOf('year').toDate();

    // Fetch all transactions for the year (optimized to only select needed fields)
    const transactions = await this.prisma.transaction.findMany({
      where: { bookId: dto.bookId, date: { gte: startDate, lte: endDate } },
      select: { type: true, amount: true, date: true },
    });

    // Initialize an array of 12 months with 0 income and 0 expense
    const monthlyData = Array.from({ length: 12 }, (_, i) => ({
      month: dayjs().month(i).format('MMM'), // 'Jan', 'Feb', etc.
      income: 0,
      expense: 0,
      net: 0,
    }));

    // Aggregate in memory (O(n) operation - very fast for a year of data)
    for (const tx of transactions) {
      const monthIndex = dayjs(tx.date).month(); // 0-11
      if (tx.type === TransactionType.INCOME) {
        monthlyData[monthIndex].income += tx.amount;
      } else {
        monthlyData[monthIndex].expense += tx.amount;
      }
    }

    // Calculate net and round values
    return monthlyData.map((m) => ({
      ...m,
      net: Math.round((m.income - m.expense) * 100) / 100,
      income: Math.round(m.income * 100) / 100,
      expense: Math.round(m.expense * 100) / 100,
    }));
  }

  // --- FEATURE 4: Fixed vs. Variable Expenses ---
  async getFixedVsVariable(dto: MonthlyInsightDto) {
    const { startDate, endDate } = this.getMonthDateRange(dto.month, dto.year);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        bookId: dto.bookId,
        type: TransactionType.EXPENSE,
        date: { gte: startDate, lte: endDate },
      },
      select: { amount: true, recurringExpenseId: true },
    });

    let fixed = 0;
    let variable = 0;

    for (const tx of transactions) {
      if (tx.recurringExpenseId) {
        fixed += tx.amount;
      } else {
        variable += tx.amount;
      }
    }

    return [
      { name: 'Fixed', value: Math.round(fixed * 100) / 100 },
      { name: 'Variable', value: Math.round(variable * 100) / 100 },
    ];
  }

  // --- FEATURE 5: Payment Method Distribution ---
  async getPaymentMethodBreakdown(dto: MonthlyInsightDto) {
    const { startDate, endDate } = this.getMonthDateRange(dto.month, dto.year);

    const groupedExpenses = await this.prisma.transaction.groupBy({
      by: ['paymentMethodId', 'recurringExpenseId'], // Include recurringExpenseId
      where: {
        bookId: dto.bookId,
        type: TransactionType.EXPENSE,
        date: { gte: startDate, lte: endDate },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    if (groupedExpenses.length === 0) return [];

    const methodIds = groupedExpenses
      .map((g) => g.paymentMethodId)
      .filter(Boolean) as string[];
    const recurringIds = groupedExpenses
      .map((g) => g.recurringExpenseId)
      .filter(Boolean) as string[];

    const [methods, recurringExpenses] = await Promise.all([
      this.prisma.paymentMethod.findMany({
        where: { id: { in: methodIds } },
        select: { id: true, name: true },
      }),
      this.prisma.reccuringExpenses.findMany({
        where: { id: { in: recurringIds } },
        select: { id: true, name: true },
      }),
    ]);

    const methodMap = new Map(methods.map((m) => [m.id, m.name]));
    const recurringMap = new Map(recurringExpenses.map((r) => [r.id, r.name]));

    return groupedExpenses.map((g) => {
      let name = 'Unspecified';

      if (g.paymentMethodId) {
        name = methodMap.get(g.paymentMethodId) || 'Unspecified';
      } else if (g.recurringExpenseId) {
        // If it's a recurring expense, label it as the recurring bill name instead of "Unspecified"
        name = recurringMap.get(g.recurringExpenseId) || 'Recurring Bill';
      }

      return {
        name,
        value: g._sum.amount ?? 0,
      };
    });
  }

  // --- FEATURE 6: Top 5 Highest Transactions (Anomaly Detection) ---
  async getTopTransactions(dto: MonthlyInsightDto) {
    const { startDate, endDate } = this.getMonthDateRange(dto.month, dto.year);

    return this.prisma.transaction.findMany({
      where: {
        bookId: dto.bookId,
        type: TransactionType.EXPENSE,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { amount: 'desc' },
      take: 5,
      select: {
        id: true,
        amount: true,
        remark: true,
        date: true,
        category: { select: { name: true } },
        paymentMethod: { select: { name: true } },
      },
    });
  }
}
