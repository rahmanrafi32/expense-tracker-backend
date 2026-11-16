import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AllocationService } from '../allocation/allocation.service';
import { TransactionService } from './transaction.service';

describe('Loan transaction protections', () => {
  function setup() {
    const prisma = {
      transaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'transaction',
          bookId: 'book',
          loanId: 'loan',
        }),
      },
      $transaction: jest.fn(),
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'transaction', balanceAfterTransaction: '100' },
        ]),
    };
    return {
      prisma,
      service: new TransactionService(
        prisma as unknown as PrismaService,
        {} as BalanceService,
        {} as AllocationService,
      ),
    };
  }
  it('rejects direct financial edits', async () => {
    const { prisma, service } = setup();
    await expect(
      service.update('user', 'transaction', { amount: '1000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects direct deletion', async () => {
    const { prisma, service } = setup();
    await expect(service.remove('user', 'transaction')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
