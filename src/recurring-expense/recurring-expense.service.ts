import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  ExpenseStatus,
  Prisma,
  ReccuringExpenses,
  TransactionType,
} from '@prisma/client';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense';
import dayjs, { Dayjs } from 'dayjs';
import { BalanceService } from '../balance/balance.service';
import { EXPENSE_FREQUENCY_MONTHS } from './constants/expense-frequency.constants';
import { type RecurringExpenseDisplayInput } from './types/recurring-expense-display.type';
import { AllocationService } from '../allocation/allocation.service';
import { getRemainingDuration } from '../utils/date-duration';

@Injectable()
export class RecurringExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private balanceService: BalanceService,
    private readonly allocationService: AllocationService,
  ) {}

  async create(userId: string, dto: CreateRecurringExpenseDto) {
    const book = await this.prisma.book.findFirst({
      where: { id: dto.bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const decimalAmount = new Prisma.Decimal(dto.amount);

    if (decimalAmount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (decimalAmount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: dto.paymentMethodId,
        OR: [{ userId }, { isDefault: true, userId: null }],
      },
    });

    if (!paymentMethod) {
      throw new BadRequestException('Payment method not found');
    }

    const created = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const recurringExpense = await tx.reccuringExpenses.create({
          data: {
            bookId: dto.bookId,
            name: dto.name,
            amount: decimalAmount,
            categoryId: category.id,
            paymentMethodId: paymentMethod.id,
            frequency: dto.frequency,
            nextDueDate: dto.nextDueDate,
            status: ExpenseStatus.UNPAID,
          },
          include: {
            category: { select: { id: true, name: true } },
            paymentMethod: { select: { id: true, name: true } },
          },
        });

        const cycleStartedAt = new Date();

        await tx.sinkingFund.create({
          data: {
            bookId: dto.bookId,
            name: dto.name,
            targetAmount: decimalAmount,
            savedAmount: new Prisma.Decimal(0),
            cycleStartedAt,
            deadline: dto.nextDueDate,
            categoryId: category.id,
            recurringExpenseId: recurringExpense.id,
          },
        });

        await this.allocationService.reconcileBook(tx, dto.bookId);

        return recurringExpense;
      },
    );

    return {
      ...created,
      category: created.category?.name || null,
      paymentMethod: created.paymentMethod?.name || null,
    };
  }

  private computeExpenseDisplay(
    bill: RecurringExpenseDisplayInput,
    now: Dayjs,
  ) {
    const daysUntilDue = dayjs(bill.nextDueDate)
      .startOf('day')
      .diff(now, 'day');
    const duration = getRemainingDuration(
      now,
      dayjs(bill.nextDueDate).startOf('day'),
    );

    let status: ExpenseStatus;

    if (daysUntilDue < 0) {
      status = ExpenseStatus.OVERDUE;
    } else if (daysUntilDue <= 7) {
      status = ExpenseStatus.UNPAID;
    } else {
      status = bill.status;
    }

    const monthlyEquivalent = new Prisma.Decimal(bill.amount)
      .div(EXPENSE_FREQUENCY_MONTHS[bill.frequency])
      .toDecimalPlaces(2);

    const shortfall = bill.sinkingFund
      ? Prisma.Decimal.max(
          new Prisma.Decimal(bill.sinkingFund.targetAmount).minus(
            new Prisma.Decimal(bill.sinkingFund.savedAmount),
          ),
          new Prisma.Decimal(0),
        )
      : new Prisma.Decimal(0);

    return {
      status,
      monthlyEquivalent: monthlyEquivalent.toNumber(),
      daysUntilDue,
      monthsLeft:
        duration.exactMonths >= 1 ? Math.ceil(duration.exactMonths) : 0,
      daysLeft: duration.exactMonths < 1 ? Math.max(daysUntilDue, 0) : 0,
      shortfall: shortfall.toFixed(2),
    };
  }

  async findAllByBook(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { id: true },
    });
    if (!book) throw new NotFoundException(`Book ${bookId} not found`);

    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
      orderBy: { nextDueDate: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        paymentMethod: { select: { id: true, name: true } },
        sinkingFund: {
          select: {
            id: true,
            targetAmount: true,
            savedAmount: true,
            deadline: true,
          },
        },
      },
    });

    const now = dayjs().startOf('day');

    return bills.map((b) => ({
      id: b.id,
      bookId: b.bookId,
      name: b.name,
      amount: b.amount,
      frequency: b.frequency,
      nextDueDate: b.nextDueDate,
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,

      category: b.category,
      paymentMethod: b.paymentMethod,
      sinkingFund: b.sinkingFund,

      ...this.computeExpenseDisplay(b, now),
    }));
  }

  private async getExpenseOrThrow(userId: string, id: string) {
    const expense = await this.prisma.reccuringExpenses.findFirst({
      where: { id, book: { userId } },
      include: {
        category: { select: { name: true } },
        sinkingFund: {
          select: {
            id: true,
            targetAmount: true,
            savedAmount: true,
            deadline: true,
          },
        },
      },
    });
    if (!expense) throw new NotFoundException(`Bill ${id} not found`);
    return expense;
  }

  async findOne(userId: string, id: string) {
    const expense = await this.getExpenseOrThrow(userId, id);
    const now = dayjs().startOf('day');

    return {
      ...expense,
      category: expense.category?.name || null,
      ...this.computeExpenseDisplay(expense, now),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecurringExpenseDto,
  ): Promise<any> {
    const expense = await this.getExpenseOrThrow(userId, id);

    if (dto.amount !== undefined) {
      const decimalAmount = new Prisma.Decimal(dto.amount);

      if (decimalAmount.isNegative()) {
        throw new BadRequestException('Amount cannot be negative');
      }

      if (decimalAmount.isZero()) {
        throw new BadRequestException('Amount must be greater than zero');
      }

      if (
        expense.sinkingFund &&
        decimalAmount.lt(new Prisma.Decimal(expense.sinkingFund.savedAmount))
      ) {
        throw new BadRequestException(
          `Amount cannot be less than the current saved amount of ${new Prisma.Decimal(
            expense.sinkingFund.savedAmount,
          ).toFixed(2)}`,
        );
      }
    }

    const data: Prisma.ReccuringExpensesUncheckedUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.amount !== undefined) data.amount = new Prisma.Decimal(dto.amount);
    if (dto.frequency !== undefined) data.frequency = dto.frequency;
    if (dto.nextDueDate !== undefined)
      data.nextDueDate = new Date(dto.nextDueDate);

    let categoryId = expense.categoryId;

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [{ userId }, { isDefault: true, userId: null }],
        },
      });

      if (!category) {
        throw new BadRequestException('Category not found.');
      }

      data.categoryId = category.id;
      categoryId = category.id;
    }

    if (dto.paymentMethodId !== undefined) {
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: dto.paymentMethodId,
          OR: [{ userId }, { isDefault: true, userId: null }],
        },
      });

      if (!paymentMethod) {
        throw new BadRequestException('Payment method not found.');
      }

      data.paymentMethodId = paymentMethod.id;
    }

    return await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updated = await tx.reccuringExpenses.update({
          where: { id },
          data,
          include: {
            category: { select: { id: true, name: true } },
            paymentMethod: { select: { id: true, name: true } },
            sinkingFund: {
              select: {
                id: true,
                targetAmount: true,
                savedAmount: true,
                deadline: true,
                cycleStartedAt: true,
              },
            },
          },
        });

        if (expense.sinkingFund) {
          const sinkingFundData: Prisma.SinkingFundUncheckedUpdateInput = {};

          if (dto.name !== undefined) {
            sinkingFundData.name = dto.name.trim();
          }

          if (dto.amount !== undefined) {
            sinkingFundData.targetAmount = new Prisma.Decimal(dto.amount);
          }

          if (dto.nextDueDate !== undefined) {
            sinkingFundData.deadline = new Date(dto.nextDueDate);
          }

          if (dto.categoryId !== undefined) {
            sinkingFundData.categoryId = categoryId;
          }

          if (Object.keys(sinkingFundData).length > 0) {
            await tx.sinkingFund.update({
              where: { id: expense.sinkingFund.id },
              data: sinkingFundData,
            });
          }
        }

        await this.allocationService.reconcileBook(tx, expense.bookId);

        return {
          ...updated,
          category: updated.category?.name || null,
          paymentMethod: updated.paymentMethod?.name || null,
        };
      },
    );
  }

  async markPaid(userId: string, id: string): Promise<ReccuringExpenses> {
    const expense = await this.getExpenseOrThrow(userId, id);

    if (expense.sinkingFund) {
      const requiredAmount = new Prisma.Decimal(
        expense.sinkingFund.targetAmount,
      );

      const savedAmount = new Prisma.Decimal(expense.sinkingFund.savedAmount);

      const shortfall = requiredAmount.minus(savedAmount);

      if (shortfall.gt(0)) {
        throw new BadRequestException(
          `Cannot mark ${expense.name} as paid. ${shortfall.toFixed(2)} is still required to fully fund this payment.`,
        );
      }
    }

    const months = EXPENSE_FREQUENCY_MONTHS[expense.frequency];
    const nextDueDate = dayjs(expense.nextDueDate).add(months, 'month');

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const paymentDate = dayjs();
      const updated = await tx.reccuringExpenses.update({
        where: { id },
        data: {
          status: ExpenseStatus.PAID,
          nextDueDate: nextDueDate.toDate(),
        },
      });

      await tx.transaction.create({
        data: {
          bookId: expense.bookId,
          type: TransactionType.EXPENSE,
          amount: expense.amount,
          remark: expense.name,
          date: paymentDate.toDate(),
          categoryId: expense.categoryId,
          paymentMethodId: expense.paymentMethodId,
          recurringExpenseId: id,
        },
      });

      const sinkingFund = await tx.sinkingFund.findUnique({
        where: {
          recurringExpenseId: id,
        },
      });

      if (sinkingFund) {
        await tx.sinkingFund.update({
          where: {
            id: sinkingFund.id,
          },
          data: {
            savedAmount: new Prisma.Decimal(0),
            deadline: nextDueDate.toDate(),
            cycleStartedAt: paymentDate.toDate(),
          },
        });
      }

      await this.allocationService.reconcileBook(tx, expense.bookId);

      await this.balanceService.updateBookBalance(tx, expense.bookId);

      return updated;
    });
  }

  async remove(userId: string, id: string): Promise<ReccuringExpenses> {
    await this.getExpenseOrThrow(userId, id);
    return this.prisma.reccuringExpenses.delete({ where: { id } });
  }

  async getSummary(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { bookTotalAmount: true },
    });
    if (!book) throw new NotFoundException(`Book ${bookId} not found`);

    const bills = await this.prisma.reccuringExpenses.findMany({
      where: { bookId },
    });
    const now = dayjs();
    const endOfMonth = now.endOf('month');

    const monthlyTotal = bills.reduce(
      (sum, b) =>
        sum.plus(
          new Prisma.Decimal(b.amount)
            .div(EXPENSE_FREQUENCY_MONTHS[b.frequency])
            .toDecimalPlaces(2),
        ),
      new Prisma.Decimal(0),
    );

    const dueThisMonth = bills.filter((b) => {
      const isUnpaid = b.status !== ExpenseStatus.PAID;
      const isDueThisMonthOrEarlier =
        dayjs(b.nextDueDate).isBefore(endOfMonth) ||
        dayjs(b.nextDueDate).isSame(endOfMonth, 'day');
      return isUnpaid && isDueThisMonthOrEarlier;
    });

    const dueThisMonthAmount = dueThisMonth.reduce(
      (sum, b) => sum.plus(new Prisma.Decimal(b.amount)),
      new Prisma.Decimal(0),
    );

    const nextDue = bills
      .filter((b) => !dayjs(b.nextDueDate).isBefore(now.startOf('day')))
      .sort(
        (a, b) =>
          dayjs(a.nextDueDate).valueOf() - dayjs(b.nextDueDate).valueOf(),
      )[0];

    const currentBalance = new Prisma.Decimal(book.bookTotalAmount ?? 0);
    const shortfallRaw = dueThisMonthAmount.minus(currentBalance);
    const hasShortfall = shortfallRaw.gt(0);
    const shortfall = hasShortfall ? shortfallRaw : new Prisma.Decimal(0);

    return {
      monthlyTotal: monthlyTotal.toFixed(2),
      dueThisMonthCount: dueThisMonth.length,
      dueThisMonthAmount: dueThisMonthAmount.toFixed(2),
      nextDue: nextDue
        ? {
            name: nextDue.name,
            amount: new Prisma.Decimal(nextDue.amount).toFixed(2),
            nextDueDate: nextDue.nextDueDate,
            daysUntil: dayjs(nextDue.nextDueDate).diff(
              now.startOf('day'),
              'day',
            ),
          }
        : null,
      currentBalance: currentBalance.toFixed(2),
      shortfall: shortfall.toFixed(2),
      hasShortfall,
      upcomingPayments: dueThisMonth.map((b) => ({
        id: b.id,
        name: b.name,
        amount: new Prisma.Decimal(b.amount).toFixed(2),
        nextDueDate: b.nextDueDate,
      })),
    };
  }
}
