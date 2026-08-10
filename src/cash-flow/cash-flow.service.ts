import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SpendingTrendsService } from '../spending-trends/spending-trends.service';
import { GetCashFlowDto, CashFlowDayDto } from './dto/cash-flow-query.dto';
import dayjs from 'dayjs';

@Injectable()
export class CashFlowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spendingTrendsService: SpendingTrendsService,
  ) {}

  async getTimeline(dto: GetCashFlowDto): Promise<CashFlowDayDto[]> {
    const daysToProject = dto.days || 90;
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });

    if (!book) throw new NotFoundException('Book not found');

    const startDate = dayjs().startOf('day');
    const endDate = startDate.add(daysToProject, 'day');
    const timeline: CashFlowDayDto[] = [];

    const spendingTrend = await this.spendingTrendsService.getSpendingTrend(
      dto.bookId,
    );

    const recurringBills = await this.prisma.reccuringExpenses.findMany({
      where: {
        bookId: dto.bookId,
        nextDueDate: { lte: endDate.toDate() },
      },
    });

    const sinkingFunds = await this.prisma.sinkingFund.findMany({
      where: {
        bookId: dto.bookId,
        deadline: { lte: endDate.toDate() },
        savedAmount: { lt: this.prisma.sinkingFund.fields.targetAmount },
      },
    });

    const incomeEvents = new Map<string, number>();
    const billEvents = new Map<string, number>();
    const sinkingEvents = new Map<string, number>();

    let currentMonth = startDate.startOf('month');
    while (
      currentMonth.isBefore(endDate) ||
      currentMonth.isSame(endDate, 'month')
    ) {
      incomeEvents.set(currentMonth.format('YYYY-MM-DD'), book.monthlyIncome);
      currentMonth = currentMonth.add(1, 'month');
    }

    for (const bill of recurringBills) {
      let billDueDate = dayjs(bill.nextDueDate).startOf('day');

      while (
        billDueDate.isBefore(endDate) ||
        billDueDate.isSame(endDate, 'day')
      ) {
        const dateKey = billDueDate.format('YYYY-MM-DD');
        billEvents.set(dateKey, (billEvents.get(dateKey) || 0) + bill.amount);

        const monthsToAdd: Record<string, number> = {
          MONTHLY: 1,
          QUARTERLY: 3,
          HALF_YEARLY: 6,
          YEARLY: 12,
        };
        billDueDate = billDueDate.add(
          monthsToAdd[bill.frequency] || 1,
          'month',
        );
      }
    }

    for (const fund of sinkingFunds) {
      const deadline = dayjs(fund.deadline).startOf('day');
      if (deadline.isAfter(endDate)) continue;

      const remaining = fund.targetAmount.minus(fund.savedAmount);
      if (remaining.gt(0)) {
        const dateKey = deadline.format('YYYY-MM-DD');
        sinkingEvents.set(
          dateKey,
          (sinkingEvents.get(dateKey) || 0) + remaining.toNumber(),
        );
      }
    }

    let currentBalance = book.bookTotalAmount;
    let currentDate = startDate;

    while (
      currentDate.isBefore(endDate) ||
      currentDate.isSame(endDate, 'day')
    ) {
      const dateKey = currentDate.format('YYYY-MM-DD');
      const daysInMonth = currentDate.daysInMonth();

      if (incomeEvents.has(dateKey)) {
        currentBalance += incomeEvents.get(dateKey)!;
      }

      if (billEvents.has(dateKey)) {
        currentBalance -= billEvents.get(dateKey)!;
      }

      if (sinkingEvents.has(dateKey)) {
        currentBalance -= sinkingEvents.get(dateKey)!;
      }

      const effectiveMonthly =
        spendingTrend.averageMonthly > 0
          ? spendingTrend.averageMonthly
          : book.expectedMonthlyExpenses;

      const dailyBurnRate = effectiveMonthly / daysInMonth;
      currentBalance -= dailyBurnRate;

      currentBalance = Math.round(currentBalance * 100) / 100;

      timeline.push({
        date: dateKey,
        balance: currentBalance,
        isShortfall: currentBalance < 0,
      });

      currentDate = currentDate.add(1, 'day');
    }

    const firstEventIndex = timeline.findIndex(
      (day) => day.balance !== book.bookTotalAmount,
    );

    if (firstEventIndex > 7) {
      return timeline.slice(firstEventIndex - 7);
    }

    return timeline;
  }
}
