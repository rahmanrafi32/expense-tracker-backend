import { Loan, LoanDirection, LoanRepayment, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { SpendingTrendsService } from '../spending-trends/spending-trends.service';
import { CashFlowService } from './cash-flow.service';

const decimal = (value: string) => new Prisma.Decimal(value);
function loan(
  direction: LoanDirection,
  due: string,
  paid = '0',
): Loan & { repayments: LoanRepayment[] } {
  return {
    id: 'loan',
    bookId: 'book',
    direction,
    personName: 'Alex',
    principal: decimal('100'),
    date: new Date('2026-01-01'),
    expectedPayoffDate: new Date(due),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    repayments:
      paid === '0'
        ? []
        : [
            {
              id: 'payment',
              loanId: 'loan',
              transactionId: 'transaction',
              amount: decimal(paid),
              date: new Date('2026-11-01'),
              notes: null,
              createdAt: new Date(),
            },
          ],
  };
}
function setup(loans: ReturnType<typeof loan>[]) {
  const prisma = {
    book: {
      findFirst: jest.fn().mockResolvedValue({
        monthlyIncome: decimal('0'),
        expectedMonthlyExpenses: decimal('0'),
      }),
    },
    transaction: {
      groupBy: jest.fn().mockResolvedValue([
        { type: 'INCOME', _sum: { amount: decimal('1000') } },
        { type: 'EXPENSE', _sum: { amount: decimal('100') } },
      ]),
      findMany: jest.fn().mockResolvedValue([]),
    },
    reccuringExpenses: { findMany: jest.fn().mockResolvedValue([]) },
    sinkingFund: {
      fields: { targetAmount: 'targetAmount' },
      findMany: jest.fn().mockResolvedValue([]),
    },
    loan: { findMany: jest.fn().mockResolvedValue(loans) },
  };
  const trends = {
    getSpendingTrendForBook: jest
      .fn()
      .mockResolvedValue({ monthsWithIncome: 0, monthsWithExpense: 0 }),
  };
  return {
    prisma,
    service: new CashFlowService(
      prisma as unknown as PrismaService,
      trends as unknown as SpendingTrendsService,
    ),
  };
}

describe('Cash flow with loans', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('projects only outstanding principal, once per loan, in the correct direction', async () => {
    const { service } = setup([
      loan('LENT', '2026-11-20', '40'),
      loan('BORROWED', '2026-11-21', '20'),
      loan('LENT', '2026-11-22', '100'),
    ]);
    const result = await service.getTimeline('user', {
      bookId: 'book',
      days: 30,
    });
    expect(result[0].balance).toBe(900);
    expect(result.find((day) => day.date === '2026-11-20')?.balance).toBe(960);
    expect(result.find((day) => day.date === '2026-11-21')?.balance).toBe(880);
    expect(result.at(-1)?.balance).toBe(880);
  });

  it('projects overdue and due-today balances once on the next projection day', async () => {
    const { service } = setup([
      loan('BORROWED', '2026-11-10'),
      loan('LENT', '2026-11-16', '50'),
    ]);
    const result = await service.getTimeline('user', {
      bookId: 'book',
      days: 30,
    });
    expect(result[0].balance).toBe(900);
    expect(result[1].balance).toBe(850);
    expect(result.at(-1)?.balance).toBe(850);
  });

  it('does not replace projected salary with a loan cash receipt', async () => {
    const { prisma, service } = setup([]);
    prisma.book.findFirst.mockResolvedValueOnce({
      monthlyIncome: decimal('500'),
      expectedMonthlyExpenses: decimal('0'),
    });
    prisma.transaction.findMany.mockResolvedValueOnce([
      {
        type: 'INCOME',
        amount: decimal('100'),
        date: new Date('2026-12-02'),
        loanId: 'loan',
      },
    ]);
    const result = await service.getTimeline('user', {
      bookId: 'book',
      days: 30,
    });
    expect(result.find((day) => day.date === '2026-12-01')?.balance).toBe(1400);
    expect(result.find((day) => day.date === '2026-12-02')?.balance).toBe(1500);
  });
});
