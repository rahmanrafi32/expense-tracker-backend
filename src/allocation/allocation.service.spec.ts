import { Prisma } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { AllocationService } from './allocation.service';

type SinkingFundRequirementCalculator = {
  calculateSinkingFundRequirement(
    tx: Prisma.TransactionClient,
    fund: {
      id: string;
      targetAmount: Prisma.Decimal;
      savedAmount: Prisma.Decimal;
      deadline: Date;
      cycleStartedAt: Date | null;
      createdAt: Date;
      recurringExpense: {
        frequency: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
      } | null;
    },
    allocationDate: Date,
  ): Promise<{ allocationRequired: Prisma.Decimal }>;
};

describe('AllocationService sinking fund cycles', () => {
  const service = new AllocationService({} as PrismaService);
  const calculator = service as unknown as SinkingFundRequirementCalculator;

  const fund = {
    id: 'inaya-fund',
    targetAmount: new Prisma.Decimal('5651.00'),
    savedAmount: new Prisma.Decimal(0),
    deadline: new Date('2027-01-15T18:00:00.000Z'),
    cycleStartedAt: new Date('2026-10-15T12:18:40.521Z'),
    createdAt: new Date('2026-08-22T18:03:56.626Z'),
    recurringExpense: { frequency: 'QUARTERLY' } as const,
  };

  it('excludes prior-cycle deposits when allocating in the new cycle', async () => {
    const aggregate = jest.fn(
      ({ where }: { where: { date: { gte: Date } } }) => {
        expect(where.date.gte).toEqual(fund.cycleStartedAt);
        return Promise.resolve({ _sum: { amount: null } });
      },
    );
    const tx = {
      sinkingFundDeposit: { aggregate },
    } as unknown as Prisma.TransactionClient;

    const requirement = await calculator.calculateSinkingFundRequirement(
      tx,
      fund,
      new Date('2026-10-20T10:00:00.000Z'),
    );

    expect(requirement.allocationRequired.toFixed(2)).toBe('1883.67');
    expect(aggregate).toHaveBeenCalledTimes(1);
  });

  it('does not allocate money dated before the current cycle began', async () => {
    const aggregate = jest.fn();
    const tx = {
      sinkingFundDeposit: { aggregate },
    } as unknown as Prisma.TransactionClient;

    const requirement = await calculator.calculateSinkingFundRequirement(
      tx,
      fund,
      new Date('2026-10-14T10:00:00.000Z'),
    );

    expect(requirement.allocationRequired.toFixed(2)).toBe('0.00');
    expect(aggregate).not.toHaveBeenCalled();
  });

  it('limits a standalone fund allocation to its monthly deadline requirement', async () => {
    const tx = {
      sinkingFundDeposit: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    } as unknown as Prisma.TransactionClient;

    const requirement = await calculator.calculateSinkingFundRequirement(
      tx,
      {
        id: 'home-repair-fund',
        targetAmount: new Prisma.Decimal('60000.00'),
        savedAmount: new Prisma.Decimal('0.00'),
        deadline: new Date('2026-12-31T18:00:00.000Z'),
        cycleStartedAt: new Date('2026-10-29T06:38:29.736Z'),
        createdAt: new Date('2026-10-29T06:38:29.749Z'),
        recurringExpense: null,
      },
      new Date('2026-11-09T11:47:35.091Z'),
    );

    expect(requirement.allocationRequired.toFixed(2)).toBe('34444.44');
  });

  it('uses the full remaining amount when the deadline is in the allocation month', async () => {
    const tx = {
      sinkingFundDeposit: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
    } as unknown as Prisma.TransactionClient;

    const requirement = await calculator.calculateSinkingFundRequirement(
      tx,
      {
        id: 'due-this-month',
        targetAmount: new Prisma.Decimal('60000.00'),
        savedAmount: new Prisma.Decimal('10000.00'),
        deadline: new Date('2026-11-30T18:00:00.000Z'),
        cycleStartedAt: new Date('2026-10-29T06:38:29.736Z'),
        createdAt: new Date('2026-10-29T06:38:29.749Z'),
        recurringExpense: null,
      },
      new Date('2026-11-09T11:47:35.091Z'),
    );

    expect(requirement.allocationRequired.toFixed(2)).toBe('50000.00');
  });

  it('does not allocate the full standalone target when a larger batch is available', async () => {
    const fundId = 'home-repair-fund';
    const targetAmount = new Prisma.Decimal('60000.00');
    const savedAmount = new Prisma.Decimal('0.00');
    const batchAmount = new Prisma.Decimal('72000.00');
    const batchUpdate = jest.fn().mockResolvedValue({});
    const depositCreate = jest.fn().mockResolvedValue({});
    const reserveCreate = jest.fn().mockResolvedValue({});
    const fundUpdate = jest.fn().mockResolvedValue({});

    const tx = {
      allocationBatch: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'income-batch', unallocatedAmount: batchAmount },
          ]),
        update: batchUpdate,
      },
      sinkingFund: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: fundId,
            name: 'Bhara Basha Repair',
            targetAmount,
            savedAmount,
            deadline: new Date('2026-12-31T18:00:00.000Z'),
            cycleStartedAt: new Date('2026-10-29T06:38:29.736Z'),
            createdAt: new Date('2026-10-29T06:38:29.749Z'),
            recurringExpense: null,
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({
          targetAmount,
          savedAmount,
          name: 'Bhara Basha Repair',
        }),
        update: fundUpdate,
      },
      sinkingFundDeposit: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(0) },
        }),
        create: depositCreate,
      },
      reserveAllocation: { create: reserveCreate },
    } as unknown as Prisma.TransactionClient;

    await service.reconcileBook(
      tx,
      'book-id',
      new Date('2026-11-09T11:47:35.091Z'),
    );

    expect(reserveCreate).toHaveBeenCalledTimes(1);
    expect(reserveCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: new Prisma.Decimal('34444.44'),
        sinkingFundId: fundId,
      }),
    });
    expect(depositCreate).toHaveBeenCalledTimes(1);
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          allocatedAmount: { increment: new Prisma.Decimal('34444.44') },
          unallocatedAmount: { decrement: new Prisma.Decimal('34444.44') },
        },
      }),
    );
    expect(fundUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          savedAmount: { increment: new Prisma.Decimal('34444.44') },
        },
      }),
    );
  });
});
