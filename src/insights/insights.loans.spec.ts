import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { InsightsService } from './insights.service';

describe('Loan reporting', () => {
  it('includes loan cash in balances while excluding it from income, spending, and savings', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { amount: new Prisma.Decimal('500') } },
        { type: 'EXPENSE', _sum: { amount: new Prisma.Decimal('200') } },
      ])
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { amount: new Prisma.Decimal('1000') } },
        { type: 'EXPENSE', _sum: { amount: new Prisma.Decimal('100') } },
      ])
      .mockResolvedValueOnce([
        { type: 'INCOME', _sum: { amount: new Prisma.Decimal('300') } },
        { type: 'EXPENSE', _sum: { amount: new Prisma.Decimal('50') } },
      ]);
    const prisma = {
      book: { findFirst: jest.fn().mockResolvedValue({ id: 'book' }) },
      transaction: { groupBy },
    };
    const service = new InsightsService(prisma as unknown as PrismaService);
    const result = await service.getMonthlyOverview('user', {
      bookId: 'book',
      month: 11,
      year: 2026,
    });
    expect(result).toMatchObject({
      totalIncome: 500,
      totalExpense: 200,
      netSavings: 300,
      savingsRate: 60,
      openingBalance: 900,
      availableCash: 1700,
      closingBalance: 1450,
      loanCashIn: 300,
      loanCashOut: 50,
    });
    const calls = groupBy.mock.calls as unknown as [
      { where: Prisma.TransactionWhereInput },
    ][];
    expect(calls[0][0].where.loanId).toBeNull();
    expect(calls[1][0].where.loanId).toBeUndefined();
    expect(calls[2][0].where.loanId).toEqual({ not: null });
  });
});
