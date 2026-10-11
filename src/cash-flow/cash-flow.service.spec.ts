import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SpendingTrendsService } from '../spending-trends/spending-trends.service';
import { CashFlowService } from './cash-flow.service';

describe('CashFlowService', () => {
  const findFirst = jest.fn();
  const groupBy = jest.fn();
  const findMany = jest.fn();
  const recurringFindMany = jest.fn();
  const sinkingFindMany = jest.fn();
  const getSpendingTrendForBook = jest.fn();
  const prisma = {
    book: { findFirst },
    transaction: { groupBy, findMany },
    reccuringExpenses: { findMany: recurringFindMany },
    sinkingFund: {
      findMany: sinkingFindMany,
      fields: { targetAmount: 'targetAmount' },
    },
  } as unknown as PrismaService;
  const spendingTrends = {
    getSpendingTrendForBook,
  } as unknown as SpendingTrendsService;
  const service = new CashFlowService(prisma, spendingTrends);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-27T12:00:00.000Z'));
    findFirst.mockReset();
    groupBy.mockReset();
    findMany.mockReset();
    recurringFindMany.mockReset();
    sinkingFindMany.mockReset();
    getSpendingTrendForBook.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses the as-of balance and replaces the average with planned income', async () => {
    findFirst.mockResolvedValue({
      monthlyIncome: new Prisma.Decimal(100),
      expectedMonthlyExpenses: new Prisma.Decimal(0),
    });
    groupBy.mockResolvedValue([
      {
        type: TransactionType.INCOME,
        _sum: { amount: new Prisma.Decimal(150) },
      },
      {
        type: TransactionType.EXPENSE,
        _sum: { amount: new Prisma.Decimal(50) },
      },
    ]);
    findMany.mockResolvedValue([
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(500),
        date: new Date('2026-10-01T00:00:00.000Z'),
      },
    ]);
    recurringFindMany.mockResolvedValue([]);
    sinkingFindMany.mockResolvedValue([]);
    getSpendingTrendForBook.mockResolvedValue({
      averageMonthly: 0,
      averageMonthlyIncome: 200,
      monthsWithExpense: 0,
      monthsWithIncome: 3,
    });

    const timeline = await service.getTimeline('user-1', {
      bookId: 'book-1',
      days: 5,
    });

    expect(timeline[0]).toEqual({
      date: '2026-09-27',
      balance: 100,
      isShortfall: false,
    });
    expect(timeline.find((day) => day.date === '2026-10-01')).toEqual({
      date: '2026-10-01',
      balance: 600,
      isShortfall: false,
    });
    expect(groupBy).toHaveBeenCalledTimes(1);
  });
});
