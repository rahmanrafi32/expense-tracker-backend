import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SpendingTrendsService } from '../spending-trends/spending-trends.service';
import { GetCashFlowDto, CashFlowDayDto } from './dto/cash-flow-query.dto';
import dayjs from 'dayjs';
import { EXPENSE_FREQUENCY_MONTHS } from '../recurring-expense/constants/expense-frequency.constants';

@Injectable()
export class CashFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spendingTrendsService: SpendingTrendsService,
  ) {}

  private addEvent(
    events: Map<string, Prisma.Decimal>,
    date: dayjs.Dayjs,
    amount: Prisma.Decimal,
  ) {
    const dateKey = date.format('YYYY-MM-DD');
    events.set(
      dateKey,
      (events.get(dateKey) ?? new Prisma.Decimal(0)).plus(amount),
    );
  }

  async getTimeline(
    userId: string,
    dto: GetCashFlowDto,
  ): Promise<CashFlowDayDto[]> {
    const daysToProject = dto.days || 90;
    const today = dayjs().startOf('day');
    const projectionStartDate = today.add(1, 'day');
    const endDate = today.add(daysToProject, 'day');

    const book = await this.prisma.book.findFirst({
      where: { id: dto.bookId, userId },
      select: {
        monthlyIncome: true,
        expectedMonthlyExpenses: true,
      },
    });

    if (!book) throw new NotFoundException('Book not found');

    const [
      spendingTrend,
      balanceTotals,
      futureTransactions,
      recurringBills,
      sinkingFunds,
    ] = await Promise.all([
      this.spendingTrendsService.getSpendingTrendForBook(dto.bookId),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          bookId: dto.bookId,
          date: { lte: today.endOf('day').toDate() },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.findMany({
        where: {
          bookId: dto.bookId,
          date: {
            gte: projectionStartDate.toDate(),
            lte: endDate.endOf('day').toDate(),
          },
        },
        select: { type: true, amount: true, date: true },
      }),
      this.prisma.reccuringExpenses.findMany({
        where: {
          bookId: dto.bookId,
          nextDueDate: { lte: endDate.endOf('day').toDate() },
        },
      }),
      this.prisma.sinkingFund.findMany({
        where: {
          bookId: dto.bookId,
          deadline: {
            gte: projectionStartDate.toDate(),
            lte: endDate.endOf('day').toDate(),
          },
          savedAmount: { lt: this.prisma.sinkingFund.fields.targetAmount },
        },
      }),
    ]);

    const incomeTotal = new Prisma.Decimal(
      balanceTotals.find((total) => total.type === TransactionType.INCOME)?._sum
        .amount ?? 0,
    );
    const expenseTotal = new Prisma.Decimal(
      balanceTotals.find((total) => total.type === TransactionType.EXPENSE)
        ?._sum.amount ?? 0,
    );
    let currentBalance = incomeTotal.minus(expenseTotal);

    const transactionEvents = new Map<string, Prisma.Decimal>();
    const incomeMonthsWithPlans = new Set<string>();
    for (const transaction of futureTransactions) {
      const transactionDate = dayjs(transaction.date).startOf('day');
      const amount = new Prisma.Decimal(transaction.amount);
      const signedAmount =
        transaction.type === TransactionType.INCOME ? amount : amount.negated();

      this.addEvent(transactionEvents, transactionDate, signedAmount);
      if (transaction.type === TransactionType.INCOME) {
        incomeMonthsWithPlans.add(transactionDate.format('YYYY-MM'));
      }
    }

    const syntheticIncomeEvents = new Map<string, Prisma.Decimal>();
    const incomeProjection =
      spendingTrend.monthsWithIncome > 0
        ? new Prisma.Decimal(spendingTrend.averageMonthlyIncome)
        : new Prisma.Decimal(book.monthlyIncome);
    let incomeMonth = projectionStartDate.startOf('month');
    if (incomeMonth.isSame(today, 'month')) {
      incomeMonth = incomeMonth.add(1, 'month');
    }
    while (
      incomeMonth.isBefore(endDate) ||
      incomeMonth.isSame(endDate, 'month')
    ) {
      if (!incomeMonthsWithPlans.has(incomeMonth.format('YYYY-MM'))) {
        this.addEvent(syntheticIncomeEvents, incomeMonth, incomeProjection);
      }
      incomeMonth = incomeMonth.add(1, 'month');
    }

    const billEvents = new Map<string, Prisma.Decimal>();
    for (const bill of recurringBills) {
      let billDueDate = dayjs(bill.nextDueDate).startOf('day');
      const frequencyMonths = EXPENSE_FREQUENCY_MONTHS[bill.frequency];

      while (billDueDate.isBefore(projectionStartDate, 'day')) {
        billDueDate = billDueDate.add(frequencyMonths, 'month');
      }

      while (
        billDueDate.isBefore(endDate, 'day') ||
        billDueDate.isSame(endDate, 'day')
      ) {
        this.addEvent(billEvents, billDueDate, new Prisma.Decimal(bill.amount));
        billDueDate = billDueDate.add(frequencyMonths, 'month');
      }
    }

    const sinkingEvents = new Map<string, Prisma.Decimal>();
    for (const fund of sinkingFunds) {
      const remaining = new Prisma.Decimal(fund.targetAmount).minus(
        new Prisma.Decimal(fund.savedAmount),
      );
      if (remaining.gt(0)) {
        this.addEvent(
          sinkingEvents,
          dayjs(fund.deadline).startOf('day'),
          remaining,
        );
      }
    }

    const effectiveMonthlyExpense =
      spendingTrend.monthsWithExpense > 0
        ? new Prisma.Decimal(spendingTrend.averageMonthly)
        : new Prisma.Decimal(book.expectedMonthlyExpenses);
    const timeline: CashFlowDayDto[] = [
      {
        date: today.format('YYYY-MM-DD'),
        balance: currentBalance.toDecimalPlaces(2).toNumber(),
        isShortfall: currentBalance.isNegative(),
      },
    ];

    let currentDate = projectionStartDate;
    while (
      currentDate.isBefore(endDate, 'day') ||
      currentDate.isSame(endDate, 'day')
    ) {
      const dateKey = currentDate.format('YYYY-MM-DD');
      currentBalance = currentBalance
        .plus(transactionEvents.get(dateKey) ?? new Prisma.Decimal(0))
        .plus(syntheticIncomeEvents.get(dateKey) ?? new Prisma.Decimal(0))
        .minus(billEvents.get(dateKey) ?? new Prisma.Decimal(0))
        .minus(sinkingEvents.get(dateKey) ?? new Prisma.Decimal(0));

      const dailyBurnRate = effectiveMonthlyExpense.div(
        currentDate.daysInMonth(),
      );
      currentBalance = currentBalance.minus(dailyBurnRate);

      timeline.push({
        date: dateKey,
        balance: currentBalance.toDecimalPlaces(2).toNumber(),
        isShortfall: currentBalance.isNegative(),
      });

      currentDate = currentDate.add(1, 'day');
    }

    return timeline;
  }
}
