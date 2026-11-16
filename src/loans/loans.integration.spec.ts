import { hash } from 'bcrypt';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AllocationService } from '../allocation/allocation.service';
import { LoansService } from './loans.service';

// Explicit opt-in only. Each run creates and drops its own isolated schema.
const connectionString = process.env.LOAN_TEST_DATABASE_URL;
const databaseTests = connectionString ? describe : describe.skip;

databaseTests('Loan PostgreSQL accounting and concurrency', () => {
  const schema = `loan_test_${randomUUID().replaceAll('-', '')}`;
  let admin: Client;
  let prisma: PrismaClient;
  let service: LoansService;
  let userId: string;
  let bookId: string;
  let paymentMethodId: string;
  const date = '2020-01-01';

  beforeAll(async () => {
    admin = new Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await admin.query(`SET search_path TO "${schema}"`);
    const output = execFileSync(
      process.execPath,
      [
        resolve('node_modules/prisma/build/index.js'),
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema',
        'src/prisma',
        '--script',
      ],
      { encoding: 'utf8' },
    );
    const ddl = output
      .slice(output.indexOf('-- CreateSchema'))
      .replaceAll('"public"', `"${schema}"`);
    await admin.query(ddl);
    prisma = new PrismaClient({
      adapter: new PrismaPg(
        { connectionString, options: `-c search_path=${schema}` },
        { schema },
      ),
    });
    const db = prisma as PrismaService;
    service = new LoansService(
      db,
      new BalanceService(db),
      new AllocationService(db),
    );
    const user = await prisma.user.create({
      data: {
        firstName: 'Loan',
        lastName: 'Test',
        email: `${schema}@example.invalid`,
        password: await hash('unused-test-fixture', 4),
      },
    });
    userId = user.id;
    const method = await prisma.paymentMethod.create({
      data: { name: 'Cash', userId },
    });
    paymentMethodId = method.id;
  }, 30000);

  beforeEach(async () => {
    const book = await prisma.book.create({
      data: { name: 'Loan test', userId },
    });
    bookId = book.id;
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
    if (admin) {
      try {
        await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    }
  });

  async function create(direction: 'LENT' | 'BORROWED' = 'BORROWED') {
    return service.create(userId, {
      bookId,
      direction,
      personName: 'Alex',
      amount: '100.00',
      date,
      expectedPayoffDate: '2020-02-01',
      paymentMethodId,
    });
  }

  it('serializes concurrent repayments so their sum cannot exceed principal', async () => {
    const loan = await create();
    const results = await Promise.allSettled([
      service.repay(userId, loan.id, { amount: '60', date, paymentMethodId }),
      service.repay(userId, loan.id, { amount: '60', date, paymentMethodId }),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      (await service.findOne(userId, loan.id)).outstandingAmount.toFixed(2),
    ).toBe('40.00');
    expect(
      (
        await prisma.book.findUniqueOrThrow({ where: { id: bookId } })
      ).bookTotalAmount.toFixed(2),
    ).toBe('40.00');
    expect(await prisma.transaction.count({ where: { bookId } })).toBe(2);
    const settled = await service.repay(userId, loan.id, {
      amount: '40',
      date,
      paymentMethodId,
    });
    expect(settled.status).toBe('SETTLED');
    expect(settled.outstandingAmount.isZero()).toBe(true);
  });

  it('rolls back loan creation when posting its cash movement fails', async () => {
    await expect(
      service.create(userId, {
        bookId,
        direction: 'LENT',
        personName: 'Alex',
        amount: '100',
        date,
        expectedPayoffDate: '2020-02-01',
        paymentMethodId: randomUUID(),
      }),
    ).rejects.toThrow('Payment method not found');
    expect(await prisma.loan.count({ where: { bookId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { bookId } })).toBe(0);
    expect(
      (
        await prisma.book.findUniqueOrThrow({ where: { id: bookId } })
      ).bookTotalAmount.isZero(),
    ).toBe(true);
  });

  it('restores consumed cash after deletion and cascades an entire book', async () => {
    const batch = await prisma.allocationBatch.create({
      data: {
        bookId,
        amount: new Prisma.Decimal(100),
        unallocatedAmount: new Prisma.Decimal(100),
        date: new Date(date),
      },
    });
    const loan = await create('LENT');
    expect(
      (
        await prisma.allocationBatch.findUniqueOrThrow({
          where: { id: batch.id },
        })
      ).unallocatedAmount.isZero(),
    ).toBe(true);
    await service.remove(userId, loan.id);
    expect(
      (
        await prisma.allocationBatch.findUniqueOrThrow({
          where: { id: batch.id },
        })
      ).unallocatedAmount.toFixed(2),
    ).toBe('100.00');
    const borrowed = await create();
    await service.repay(userId, borrowed.id, {
      amount: '20',
      date,
      paymentMethodId,
    });
    await prisma.book.delete({ where: { id: bookId } });
    expect(await prisma.loan.count({ where: { bookId } })).toBe(0);
    expect(await prisma.transaction.count({ where: { bookId } })).toBe(0);
    expect(
      await prisma.loanRepayment.count({ where: { loanId: borrowed.id } }),
    ).toBe(0);
  });
});
