import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from './balance.service';

describe('Book cash balance', () => {
  it('sums all cash movements exactly, including values that lose precision as JavaScript numbers', async () => {
    const tx = {
      transaction: {
        findMany: jest.fn().mockResolvedValue([
          { type: 'INCOME', amount: new Prisma.Decimal('999999999999.99') },
          { type: 'INCOME', amount: new Prisma.Decimal('0.01') },
          { type: 'EXPENSE', amount: new Prisma.Decimal('999999999999.99') },
        ]),
      },
      book: { update: jest.fn().mockResolvedValue({}) },
    };
    const service = new BalanceService({} as PrismaService);
    const result = await service.getBookBalanceWithTx(
      tx as unknown as Prisma.TransactionClient,
      'book',
    );
    expect(result.balance.toFixed(2)).toBe('0.01');
    expect(result.totalCashIn.toFixed(2)).toBe('1000000000000.00');
  });
});
