import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Loan, LoanDirection, LoanRepayment, Prisma } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AllocationService } from '../allocation/allocation.service';
import { BalanceService } from '../balance/balance.service';
import { PrismaService } from '../database/prisma.service';
import {
  CreateLoanDto,
  LoanPaymentDto,
  LoanStatus,
  UpdateLoanDto,
} from './dto/loan.dto';
import { loanProgress, LoansService } from './loans.service';

const decimal = (amount: string) => new Prisma.Decimal(amount);
const original: Loan & { repayments: LoanRepayment[] } = {
  id: 'loan',
  bookId: 'book',
  direction: LoanDirection.LENT,
  personName: 'Alex',
  principal: decimal('100.10'),
  date: new Date('2026-01-01'),
  expectedPayoffDate: new Date('2026-12-01'),
  notes: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  repayments: [],
};
const payment: LoanPaymentDto = {
  amount: '40.05',
  date: '2026-11-16',
  paymentMethodId: 'method',
};
const repayment = (amount: string): LoanRepayment => ({
  id: 'repayment',
  loanId: 'loan',
  amount: decimal(amount),
  date: new Date(payment.date),
  notes: null,
  transactionId: 'transaction',
  createdAt: new Date(payment.date),
});

function setup(loan = original) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    book: { findFirst: jest.fn().mockResolvedValue({ id: 'book' }) },
    loan: {
      findFirst: jest.fn().mockImplementation(() => Promise.resolve(loan)),
      create: jest.fn().mockImplementation(() => Promise.resolve(loan)),
      update: jest.fn().mockResolvedValue(loan),
      delete: jest.fn().mockResolvedValue(loan),
    },
    paymentMethod: { findFirst: jest.fn().mockResolvedValue({ id: 'method' }) },
    transaction: {
      create: jest
        .fn()
        .mockResolvedValue({ id: 'transaction', date: new Date(payment.date) }),
      findMany: jest.fn().mockResolvedValue([{ id: 'transaction' }]),
      delete: jest.fn().mockResolvedValue({ id: 'transaction' }),
    },
    loanRepayment: {
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    allocationConsumption: {
      findMany: jest.fn().mockResolvedValue([
        { batchId: 'first', amount: decimal('10.05') },
        { batchId: 'second', amount: decimal('30.00') },
      ]),
    },
    allocationBatch: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(
      (callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(tx as unknown as Prisma.TransactionClient),
    ),
  };
  const balance = { updateBookBalance: jest.fn().mockResolvedValue(undefined) };
  const allocation = {
    consumeUnallocated: jest.fn().mockResolvedValue(undefined),
  };
  const service = new LoansService(
    prisma as unknown as PrismaService,
    balance as unknown as BalanceService,
    allocation as unknown as AllocationService,
  );
  return { tx, prisma, balance, allocation, service };
}

describe('LoansService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('derives exact decimal progress and separates overdue from settlement', () => {
    const loan = {
      ...original,
      expectedPayoffDate: new Date('2026-11-15'),
      repayments: [repayment('40.05')],
    };
    expect(loanProgress(loan)).toMatchObject({
      status: LoanStatus.PARTIALLY_REPAID,
      isOverdue: true,
      isDueToday: false,
    });
    expect(loanProgress(loan).outstandingAmount.toFixed(2)).toBe('60.05');
    expect(
      loanProgress({ ...loan, repayments: [repayment('100.10')] }),
    ).toMatchObject({ status: LoanStatus.SETTLED, isOverdue: false });
    expect(
      loanProgress({ ...original, expectedPayoffDate: new Date('2026-11-16') })
        .isDueToday,
    ).toBe(true);
  });

  it.each([LoanDirection.LENT, LoanDirection.BORROWED])(
    'posts the correct initial cash direction for %s',
    async (direction) => {
      const { service, tx, balance, allocation } = setup({
        ...original,
        direction,
      });
      await service.create('user', {
        ...payment,
        amount: '100.10',
        direction,
        bookId: 'book',
        personName: 'Alex',
        expectedPayoffDate: '2026-12-01',
      });
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: direction === 'LENT' ? 'EXPENSE' : 'INCOME',
          loanId: 'loan',
        }) as unknown,
      });
      expect(tx.$queryRaw).toHaveBeenCalled();
      expect(balance.updateBookBalance).toHaveBeenCalled();
      expect(allocation.consumeUnallocated).toHaveBeenCalledTimes(
        direction === 'LENT' ? 1 : 0,
      );
    },
  );

  it.each([LoanDirection.LENT, LoanDirection.BORROWED])(
    'posts the opposite cash direction for repayments of %s',
    async (direction) => {
      const { service, tx, allocation } = setup({ ...original, direction });
      await service.repay('user', 'loan', payment);
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: direction === 'LENT' ? 'INCOME' : 'EXPENSE',
        }) as unknown,
      });
      expect(tx.loanRepayment.create).toHaveBeenCalled();
      expect(allocation.consumeUnallocated).toHaveBeenCalledTimes(
        direction === 'BORROWED' ? 1 : 0,
      );
    },
  );

  it.each(['0', '-1', '100.11'])(
    'rejects invalid repayment %s before posting cash',
    async (amount) => {
      const { service, tx } = setup();
      await expect(
        service.repay('user', 'loan', { ...payment, amount }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.transaction.create).not.toHaveBeenCalled();
    },
  );

  it.each(['2025-12-31', '2026-11-17', '2026-02-30'])(
    'rejects invalid payment date %s',
    async (date) => {
      const { service, tx } = setup();
      await expect(
        service.repay('user', 'loan', { ...payment, date }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.transaction.create).not.toHaveBeenCalled();
    },
  );

  it('rejects inaccessible books and loans', async () => {
    const { service, tx } = setup();
    tx.loan.findFirst.mockResolvedValueOnce(null);
    await expect(service.findOne('other', 'loan')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    tx.book.findFirst.mockResolvedValueOnce(null);
    await expect(service.summary('other', 'book')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('rejects inaccessible payment methods', async () => {
    const { service, tx } = setup();
    tx.paymentMethod.findFirst.mockResolvedValueOnce(null);
    await expect(service.repay('user', 'loan', payment)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.transaction.create).not.toHaveBeenCalled();
  });

  it('restores exactly the consumed batches when reversing a repayment', async () => {
    const { service, tx, balance } = setup({
      ...original,
      repayments: [repayment('40.05')],
    });
    await service.removeRepayment('user', 'loan', 'repayment');
    expect(tx.allocationBatch.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'first' },
      data: { unallocatedAmount: { increment: decimal('10.05') } },
    });
    expect(tx.allocationBatch.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'second' },
      data: { unallocatedAmount: { increment: decimal('30.00') } },
    });
    expect(tx.loanRepayment.delete).toHaveBeenCalled();
    expect(tx.transaction.delete).toHaveBeenCalled();
    expect(balance.updateBookBalance).toHaveBeenCalled();
  });

  it('prevents deleting a loan with repayments', async () => {
    const { service, tx } = setup({
      ...original,
      repayments: [repayment('40.05')],
    });
    await expect(service.remove('user', 'loan')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.loan.delete).not.toHaveBeenCalled();
  });

  it('reverses the cash movement before deleting an unpaid loan', async () => {
    const { service, tx } = setup();
    await service.remove('user', 'loan');
    expect(tx.transaction.delete).toHaveBeenCalledWith({
      where: { id: 'transaction' },
    });
    expect(tx.loan.delete).toHaveBeenCalledWith({ where: { id: 'loan' } });
  });

  it('validates metadata corrections against the original loan date', async () => {
    const { service, tx } = setup();
    await expect(
      service.update('user', 'loan', { expectedPayoffDate: '2025-12-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await service.update('user', 'loan', { personName: 'Sam' });
    expect(tx.loan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ personName: 'Sam' }) as unknown,
      }),
    );
  });

  it('rejects null corrections and oversized monetary inputs at the API boundary', async () => {
    expect(
      await validate(plainToInstance(UpdateLoanDto, { personName: null })),
    ).not.toHaveLength(0);
    expect(
      await validate(
        plainToInstance(CreateLoanDto, {
          ...payment,
          amount: '1000000000000.00',
        }),
      ),
    ).not.toHaveLength(0);
  });
});
