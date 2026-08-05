import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GetCashFlowDto, CashFlowDayDto } from './dto/cash-flow-query.dto';
import dayjs from 'dayjs';

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  async getTimeline(dto: GetCashFlowDto): Promise<CashFlowDayDto[]> {
    const daysToProject = dto.days || 90;
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });

    if (!book) throw new NotFoundException('Book not found');

    const startDate = dayjs().startOf('day');
    const endDate = startDate.add(daysToProject, 'day');
    const timeline: CashFlowDayDto[] = [];

    // ---------------------------------------------------------
    // 1. FETCH RAW DATA
    // ---------------------------------------------------------

    // A. Recurring Bills: Find all that have a due date within our window
    const recurringBills = await this.prisma.reccuringExpenses.findMany({
      where: {
        bookId: dto.bookId,
        nextDueDate: { lte: endDate.toDate() },
      },
    });

    // B. Sinking Funds: Find unfunded goals that have a deadline within our window
    const sinkingFunds = await this.prisma.sinkingFund.findMany({
      where: {
        bookId: dto.bookId,
        deadline: { lte: endDate.toDate() },
        savedAmount: { lt: this.prisma.sinkingFund.fields.targetAmount }, // Only unfunded
      },
    });

    // ---------------------------------------------------------
    // 2. PRE-CALCULATE EVENTS INTO MAPS (O(1) Lookups)
    // ---------------------------------------------------------

    const incomeEvents = new Map<string, number>(); // 'YYYY-MM-DD' -> amount
    const billEvents = new Map<string, number>(); // 'YYYY-MM-DD' -> amount
    const sinkingEvents = new Map<string, number>(); // 'YYYY-MM-DD' -> amount

    // Map Monthly Income (Assume income arrives on the 1st of every month)
    let currentMonth = startDate.startOf('month');
    while (
      currentMonth.isBefore(endDate) ||
      currentMonth.isSame(endDate, 'month')
    ) {
      incomeEvents.set(currentMonth.format('YYYY-MM-DD'), book.monthlyIncome);
      currentMonth = currentMonth.add(1, 'month');
    }

    // Map Recurring Bills (Crucial: Simulate multiple cycles if a monthly bill hits 3 times in 90 days)
    for (const bill of recurringBills) {
      let billDueDate = dayjs(bill.nextDueDate).startOf('day');

      // Keep pushing the date forward by its frequency as long as it's within our window
      while (
        billDueDate.isBefore(endDate) ||
        billDueDate.isSame(endDate, 'day')
      ) {
        const dateKey = billDueDate.format('YYYY-MM-DD');

        // Accumulate if multiple bills happen to fall on the exact same day
        billEvents.set(dateKey, (billEvents.get(dateKey) || 0) + bill.amount);

        // Advance to the next cycle
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

    // Map Sinking Funds (They only impact the timeline on their exact deadline)
    for (const fund of sinkingFunds) {
      const deadline = dayjs(fund.deadline).startOf('day');
      if (deadline.isAfter(endDate)) continue;

      const remaining = fund.targetAmount - fund.savedAmount;
      if (remaining > 0) {
        const dateKey = deadline.format('YYYY-MM-DD');
        sinkingEvents.set(
          dateKey,
          (sinkingEvents.get(dateKey) || 0) + remaining,
        );
      }
    }

    // ---------------------------------------------------------
    // 3. RUN THE DAY-BY-DAY SIMULATION
    // ---------------------------------------------------------

    let currentBalance = book.bookTotalAmount;
    let currentDate = startDate;

    while (
      currentDate.isBefore(endDate) ||
      currentDate.isSame(endDate, 'day')
    ) {
      const dateKey = currentDate.format('YYYY-MM-DD');
      const daysInMonth = currentDate.daysInMonth();

      // A. Apply Income
      if (incomeEvents.has(dateKey)) {
        currentBalance += incomeEvents.get(dateKey)!;
      }

      // B. Apply Recurring Bills
      if (billEvents.has(dateKey)) {
        currentBalance -= billEvents.get(dateKey)!;
      }

      // C. Apply Sinking Fund Payouts
      if (sinkingEvents.has(dateKey)) {
        currentBalance -= sinkingEvents.get(dateKey)!;
      }

      // D. Apply Daily Variable Expenses (Smooth burn rate to prevent jagged graphs)
      // We divide the monthly expected expense by the days in the current month
      const dailyBurnRate = book.expectedMonthlyExpenses / daysInMonth;
      currentBalance -= dailyBurnRate;

      // Prevent floating point drift over 90 days, keep it to 2 decimal places
      currentBalance = Math.round(currentBalance * 100) / 100;

      // Push to timeline array
      timeline.push({
        date: dateKey,
        balance: currentBalance,
        isShortfall: currentBalance < 0,
      });

      // Move to next day
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
