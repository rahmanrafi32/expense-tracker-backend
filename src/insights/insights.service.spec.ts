import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InsightsService } from './insights.service';

describe('InsightsService', () => {
  const findFirst = jest.fn();
  const groupBy = jest.fn();
  const prisma = {
    book: { findFirst },
    transaction: { groupBy },
  } as unknown as PrismaService;
  const service = new InsightsService(prisma);

  beforeEach(() => {
    findFirst.mockReset();
    groupBy.mockReset();
  });

  it('uses carryover when calculating whether a month has a cash shortfall', async () => {
    findFirst.mockResolvedValue({ id: 'book-1' });
    groupBy
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          _sum: { amount: new Prisma.Decimal(100) },
        },
        {
          type: TransactionType.EXPENSE,
          _sum: { amount: new Prisma.Decimal(110) },
        },
      ])
      .mockResolvedValueOnce([
        {
          type: TransactionType.INCOME,
          _sum: { amount: new Prisma.Decimal(10) },
        },
      ]);

    const result = await service.getMonthlyOverview('user-1', {
      bookId: 'book-1',
      month: 2,
      year: 2026,
    });

    expect(result).toMatchObject({
      totalIncome: 100,
      totalExpense: 110,
      netSavings: -10,
      openingBalance: 10,
      availableCash: 110,
      closingBalance: 0,
      cashShortfall: 0,
    });
  });
});
