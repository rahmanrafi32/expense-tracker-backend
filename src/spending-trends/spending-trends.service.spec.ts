import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SpendingTrendsService } from './spending-trends.service';

describe('SpendingTrendsService', () => {
  const findFirst = jest.fn();
  const findMany = jest.fn();
  const prisma = {
    book: { findFirst },
    transaction: { findMany },
  } as unknown as PrismaService;
  const service = new SpendingTrendsService(prisma);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));
    findFirst.mockReset();
    findMany.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('averages three completed months including zero-activity months', async () => {
    findFirst.mockResolvedValue({ id: 'book-1' });
    findMany.mockResolvedValue([
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(300),
        date: new Date('2025-11-04T00:00:00.000Z'),
        recurringExpenseId: null,
        emergencyFundId: null,
      },
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(30),
        date: new Date('2025-11-08T00:00:00.000Z'),
        recurringExpenseId: null,
        emergencyFundId: null,
      },
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(600),
        date: new Date('2026-01-05T00:00:00.000Z'),
        recurringExpenseId: null,
        emergencyFundId: null,
      },
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(60),
        date: new Date('2026-01-10T00:00:00.000Z'),
        recurringExpenseId: null,
        emergencyFundId: null,
      },
      {
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal(500),
        date: new Date('2026-01-12T00:00:00.000Z'),
        recurringExpenseId: 'recurring-1',
        emergencyFundId: null,
      },
      {
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal(50),
        date: new Date('2026-01-14T00:00:00.000Z'),
        recurringExpenseId: null,
        emergencyFundId: 'emergency-1',
      },
    ]);

    const result = await service.getSpendingTrend('user-1', 'book-1');

    expect(result.averageMonthly).toBe(30);
    expect(result.averageMonthlyIncome).toBe(300);
    expect(result.monthsUsed).toBe(3);
    expect(result.monthsWithExpense).toBe(2);
    expect(result.monthsWithIncome).toBe(2);
    expect(result.months).toEqual([
      expect.objectContaining({ monthKey: '2025-11', total: 30, income: 300 }),
      expect.objectContaining({ monthKey: '2025-12', total: 0, income: 0 }),
      expect.objectContaining({ monthKey: '2026-01', total: 60, income: 600 }),
    ]);
  });
});
