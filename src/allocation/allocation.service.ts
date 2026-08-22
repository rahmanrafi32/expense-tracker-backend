import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

import { PrismaService } from '../database/prisma.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { EXPENSE_FREQUENCY_MONTHS } from '../recurring-expense/constants/expense-frequency.constants';

@Injectable()
export class AllocationService {
  constructor(private readonly prisma: PrismaService) {}

  private async calculateSinkingFundRequirement(
    tx: Prisma.TransactionClient,
    fund: {
      id: string;
      targetAmount: Prisma.Decimal;
      savedAmount: Prisma.Decimal;
      deadline: Date;
      cycleStartedAt: Date | null;
      createdAt: Date;
      recurringExpense: {
        frequency: keyof typeof EXPENSE_FREQUENCY_MONTHS;
      } | null;
    },
    allocationDate: Date,
  ) {
    const targetAmount = new Prisma.Decimal(fund.targetAmount);
    const savedAmount = new Prisma.Decimal(fund.savedAmount);

    const remainingAmount = Prisma.Decimal.max(
      targetAmount.minus(savedAmount),
      new Prisma.Decimal(0),
    );

    if (remainingAmount.isZero()) {
      return {
        remainingAmount,
        normalMonthlyAmount: new Prisma.Decimal(0),
        requiredMonthlyAmount: new Prisma.Decimal(0),
        alreadyAllocatedThisPeriod: new Prisma.Decimal(0),
        allocationRequired: new Prisma.Decimal(0),
      };
    }

    if (!fund.recurringExpense) {
      return {
        remainingAmount,
        normalMonthlyAmount: new Prisma.Decimal(0),
        requiredMonthlyAmount: new Prisma.Decimal(0),
        alreadyAllocatedThisPeriod: new Prisma.Decimal(0),
        allocationRequired: new Prisma.Decimal(0),
      };
    }

    const frequencyMonths =
      EXPENSE_FREQUENCY_MONTHS[fund.recurringExpense.frequency];

    if (!frequencyMonths || frequencyMonths <= 0) {
      return {
        remainingAmount,
        normalMonthlyAmount: new Prisma.Decimal(0),
        requiredMonthlyAmount: new Prisma.Decimal(0),
        alreadyAllocatedThisPeriod: new Prisma.Decimal(0),
        allocationRequired: new Prisma.Decimal(0),
      };
    }

    const normalMonthlyAmount = targetAmount
      .div(frequencyMonths)
      .toDecimalPlaces(2);

    const allocationDay = dayjs(allocationDate).startOf('month');
    const deadlineDay = dayjs(fund.deadline).startOf('month');

    let remainingMonths = deadlineDay.diff(allocationDay, 'month');

    if (remainingMonths <= 0) {
      remainingMonths = 1;
    }

    const requiredMonthlyAmount = remainingAmount
      .div(remainingMonths)
      .toDecimalPlaces(2);

    const cycleStartedAt = dayjs(fund.cycleStartedAt ?? fund.createdAt);

    const monthsSinceCycleStart = Math.max(
      allocationDay.diff(cycleStartedAt.startOf('month'), 'month'),
      0,
    );

    const currentPeriodStart = cycleStartedAt
      .startOf('month')
      .add(monthsSinceCycleStart, 'month');

    const currentPeriodEnd = currentPeriodStart.add(1, 'month');

    const deposits = await tx.sinkingFundDeposit.aggregate({
      where: {
        sinkingFundId: fund.id,
        date: {
          gte: currentPeriodStart.toDate(),
          lt: currentPeriodEnd.toDate(),
        },
      },
      _sum: {
        amount: true,
      },
    });

    const alreadyAllocatedThisPeriod =
      deposits._sum.amount ?? new Prisma.Decimal(0);

    const monthlyCapacity =
      remainingMonths <= 1
        ? remainingAmount
        : Prisma.Decimal.min(normalMonthlyAmount, remainingAmount);
    const allocationRequired = Prisma.Decimal.max(
      monthlyCapacity.minus(alreadyAllocatedThisPeriod),
      new Prisma.Decimal(0),
    );

    return {
      remainingAmount,
      normalMonthlyAmount,
      requiredMonthlyAmount,
      alreadyAllocatedThisPeriod,
      allocationRequired,
    };
  }

  async create(userId: string, dto: CreateAllocationDto) {
    const book = await this.prisma.book.findFirst({
      where: {
        id: dto.bookId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    const amount = new Prisma.Decimal(dto.amount);

    if (amount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (amount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const allocationDate = dto.date
      ? dayjs(dto.date).toDate()
      : dayjs().toDate();

    if (Number.isNaN(allocationDate.getTime())) {
      throw new BadRequestException('Invalid allocation date');
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      return this.allocate(tx, dto.bookId, amount, allocationDate, dto.note);
    });
  }

  async allocate(
    tx: Prisma.TransactionClient,
    bookId: string,
    amount: Prisma.Decimal,
    allocationDate: Date,
    note?: string,
    sourceTransactionId?: string,
  ) {
    if (amount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (amount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (Number.isNaN(allocationDate.getTime())) {
      throw new BadRequestException('Invalid allocation date');
    }

    if (sourceTransactionId) {
      const existingBatch = await tx.allocationBatch.findFirst({
        where: {
          sourceTransactionId,
        },
        include: {
          allocations: {
            include: {
              sinkingFund: {
                select: {
                  id: true,
                  name: true,
                },
              },
              goal: {
                select: {
                  id: true,
                  name: true,
                },
              },
              emergencyFund: {
                select: {
                  id: true,
                  amount: true,
                  type: true,
                },
              },
            },
          },
        },
      });

      if (existingBatch) {
        return existingBatch;
      }
    }

    // Reuse older unallocated money before processing the new income.
    await this.reconcileBook(tx, bookId, allocationDate);

    const batch = await tx.allocationBatch.create({
      data: {
        bookId,
        amount,
        allocatedAmount: new Prisma.Decimal(0),
        unallocatedAmount: amount,
        date: allocationDate,
        note,
        ...(sourceTransactionId && {
          sourceTransactionId,
        }),
      },
    });

    let remaining = new Prisma.Decimal(amount);
    let allocatedAmount = new Prisma.Decimal(0);

    const emergencyTotals = await tx.emergencyFund.groupBy({
      by: ['type'],
      where: {
        bookId,
      },
      _sum: {
        amount: true,
      },
    });

    const totalBorrowed =
      emergencyTotals.find((item) => item.type === 'WITHDRAWAL')?._sum.amount ??
      new Prisma.Decimal(0);

    const totalRepaid =
      emergencyTotals.find((item) => item.type === 'REPAYMENT')?._sum.amount ??
      new Prisma.Decimal(0);

    const emergencyOutstanding = Prisma.Decimal.max(
      totalBorrowed.minus(totalRepaid),
      new Prisma.Decimal(0),
    );

    if (remaining.gt(0) && emergencyOutstanding.gt(0)) {
      const emergencyAllocation = Prisma.Decimal.min(
        remaining,
        emergencyOutstanding,
      );

      if (emergencyAllocation.gt(0)) {
        const emergencyFund = await tx.emergencyFund.create({
          data: {
            bookId,
            categoryId: 'ac3efb42-f845-4bd2-9d0f-1c0d32c106df',
            paymentMethodId: '8e9501cf-771c-42de-b76d-2135727c9766',
            type: 'REPAYMENT',
            amount: emergencyAllocation,
            remark: 'Automatic emergency fund repayment',
            date: allocationDate,
          },
        });

        await tx.reserveAllocation.create({
          data: {
            batchId: batch.id,
            type: 'EMERGENCY_REPAYMENT',
            amount: emergencyAllocation,
            emergencyFundId: emergencyFund.id,
            note: 'Automatic emergency fund repayment allocation',
          },
        });

        await tx.transaction.create({
          data: {
            bookId,
            type: 'INCOME',
            amount: emergencyAllocation,
            remark: 'Emergency fund repayment',
            date: allocationDate,
            categoryId: 'ac3efb42-f845-4bd2-9d0f-1c0d32c106df',
            paymentMethodId: '8e9501cf-771c-42de-b76d-2135727c9766',
          },
        });

        remaining = remaining.minus(emergencyAllocation);
        allocatedAmount = allocatedAmount.plus(emergencyAllocation);
      }
    }

    if (remaining.gt(0)) {
      const sinkingFunds = await tx.sinkingFund.findMany({
        where: {
          bookId,
          recurringExpenseId: {
            not: null,
          },
        },
        include: {
          recurringExpense: {
            select: {
              frequency: true,
            },
          },
        },
        orderBy: {
          deadline: 'asc',
        },
      });

      for (const fund of sinkingFunds) {
        if (remaining.isZero()) {
          break;
        }

        const requirement = await this.calculateSinkingFundRequirement(
          tx,
          fund,
          allocationDate,
        );

        if (requirement.remainingAmount.lte(0)) {
          continue;
        }

        const currentFund = await tx.sinkingFund.findUnique({
          where: {
            id: fund.id,
          },
          select: {
            targetAmount: true,
            savedAmount: true,
          },
        });

        if (!currentFund) {
          continue;
        }

        const currentTarget = new Prisma.Decimal(currentFund.targetAmount);
        const currentSaved = new Prisma.Decimal(currentFund.savedAmount);

        const currentRemaining = Prisma.Decimal.max(
          currentTarget.minus(currentSaved),
          new Prisma.Decimal(0),
        );

        if (currentRemaining.isZero()) {
          continue;
        }

        const allocationAmount = Prisma.Decimal.min(
          remaining,
          currentRemaining,
          requirement.allocationRequired.isZero()
            ? currentRemaining
            : requirement.allocationRequired,
        );

        if (
          !requirement.allocationRequired.isZero() &&
          allocationAmount.lt(requirement.allocationRequired) &&
          allocationAmount.lt(currentRemaining)
        ) {
          continue;
        }

        if (allocationAmount.lte(0)) {
          continue;
        }

        await tx.reserveAllocation.create({
          data: {
            batchId: batch.id,
            type: 'SINKING_FUND',
            amount: allocationAmount,
            sinkingFundId: fund.id,
            note: `Automatic allocation for ${fund.name}`,
          },
        });

        await tx.sinkingFundDeposit.create({
          data: {
            sinkingFundId: fund.id,
            amount: allocationAmount,
            date: allocationDate,
            note: 'Automatic allocation',
          },
        });

        await tx.sinkingFund.update({
          where: {
            id: fund.id,
          },
          data: {
            savedAmount: {
              increment: allocationAmount,
            },
          },
        });

        remaining = Prisma.Decimal.max(
          remaining.minus(allocationAmount),
          new Prisma.Decimal(0),
        );

        allocatedAmount = allocatedAmount.plus(allocationAmount);
      }
    }

    if (remaining.gt(0)) {
      const goals = await tx.goal.findMany({
        where: {
          bookId,
          deadline: {
            gte: allocationDate,
          },
        },
        orderBy: {
          deadline: 'asc',
        },
      });

      for (const goal of goals) {
        if (remaining.isZero()) {
          break;
        }

        const targetAmount = new Prisma.Decimal(goal.targetAmount);
        const savedAmount = new Prisma.Decimal(goal.savedAmount);

        const requiredAmount = Prisma.Decimal.max(
          targetAmount.minus(savedAmount),
          new Prisma.Decimal(0),
        );

        if (requiredAmount.isZero()) {
          continue;
        }

        const allocationAmount = Prisma.Decimal.min(remaining, requiredAmount);

        if (allocationAmount.lte(0)) {
          continue;
        }

        await tx.reserveAllocation.create({
          data: {
            batchId: batch.id,
            type: 'GOAL',
            amount: allocationAmount,
            goalId: goal.id,
            note: `Automatic allocation for ${goal.name}`,
          },
        });

        await tx.goalDeposit.create({
          data: {
            goalId: goal.id,
            amount: allocationAmount,
            date: allocationDate,
            note: 'Automatic allocation',
          },
        });

        await tx.goal.update({
          where: {
            id: goal.id,
          },
          data: {
            savedAmount: {
              increment: allocationAmount,
            },
          },
        });

        remaining = Prisma.Decimal.max(
          remaining.minus(allocationAmount),
          new Prisma.Decimal(0),
        );

        allocatedAmount = allocatedAmount.plus(allocationAmount);
      }
    }

    const unallocatedAmount = Prisma.Decimal.max(
      amount.minus(allocatedAmount),
      new Prisma.Decimal(0),
    );

    const finalAllocatedAmount = amount.minus(unallocatedAmount);

    await tx.allocationBatch.update({
      where: {
        id: batch.id,
      },
      data: {
        allocatedAmount: finalAllocatedAmount,
        unallocatedAmount,
      },
    });

    return tx.allocationBatch.findUnique({
      where: {
        id: batch.id,
      },
      include: {
        allocations: {
          include: {
            sinkingFund: {
              select: {
                id: true,
                name: true,
              },
            },
            goal: {
              select: {
                id: true,
                name: true,
              },
            },
            emergencyFund: {
              select: {
                id: true,
                amount: true,
                type: true,
              },
            },
          },
        },
      },
    });
  }

  /** Reconciles money that was previously left unallocated in this book. */
  async reconcileBook(
    tx: Prisma.TransactionClient,
    bookId: string,
    allocationDate = dayjs().toDate(),
  ) {
    const batches = await tx.allocationBatch.findMany({
      where: { bookId, unallocatedAmount: { gt: 0 } },
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    });

    const funds = await tx.sinkingFund.findMany({
      where: { bookId },
      orderBy: { deadline: 'asc' },
      include: {
        recurringExpense: { select: { frequency: true } },
      },
    });

    for (const batch of batches) {
      let remaining = new Prisma.Decimal(batch.unallocatedAmount);

      for (const fund of funds) {
        if (remaining.isZero()) break;

        const current = await tx.sinkingFund.findUnique({
          where: { id: fund.id },
          select: { targetAmount: true, savedAmount: true, name: true },
        });
        if (!current) continue;

        const remainingTarget = Prisma.Decimal.max(
          new Prisma.Decimal(current.targetAmount).minus(current.savedAmount),
          new Prisma.Decimal(0),
        );
        const requirement = fund.recurringExpense
          ? await this.calculateSinkingFundRequirement(
              tx,
              { ...fund, savedAmount: current.savedAmount },
              allocationDate,
            )
          : null;
        const monthlyEquivalent =
          requirement?.allocationRequired ?? remainingTarget;
        const allocationAmount = Prisma.Decimal.min(
          remaining,
          remainingTarget,
          monthlyEquivalent,
        );

        if (
          fund.recurringExpense &&
          allocationAmount.lt(monthlyEquivalent) &&
          allocationAmount.lt(remainingTarget)
        ) {
          continue;
        }

        if (allocationAmount.isZero()) continue;

        await tx.reserveAllocation.create({
          data: {
            batchId: batch.id,
            type: 'SINKING_FUND',
            sinkingFundId: fund.id,
            amount: allocationAmount,
            note: `Automatic allocation for ${current.name}`,
          },
        });
        await tx.sinkingFundDeposit.create({
          data: {
            sinkingFundId: fund.id,
            amount: allocationAmount,
            date: allocationDate,
            note: 'Automatic allocation',
          },
        });
        await tx.sinkingFund.update({
          where: { id: fund.id },
          data: { savedAmount: { increment: allocationAmount } },
        });

        remaining = remaining.minus(allocationAmount);
        await tx.allocationBatch.update({
          where: { id: batch.id },
          data: {
            allocatedAmount: { increment: allocationAmount },
            unallocatedAmount: { decrement: allocationAmount },
          },
        });
      }
    }
  }

  async findAllByBook(userId: string, bookId: string) {
    const book = await this.prisma.book.findFirst({
      where: {
        id: bookId,
        userId,
      },
      select: {
        id: true,
      },
    });

    if (!book) {
      throw new NotFoundException(`Book ${bookId} not found`);
    }

    return this.prisma.allocationBatch.findMany({
      where: {
        bookId,
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        allocations: {
          include: {
            sinkingFund: {
              select: {
                id: true,
                name: true,
              },
            },
            goal: {
              select: {
                id: true,
                name: true,
              },
            },
            emergencyFund: {
              select: {
                id: true,
                amount: true,
                type: true,
              },
            },
          },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const batch = await this.prisma.allocationBatch.findFirst({
      where: {
        id,
        book: {
          userId,
        },
      },
      include: {
        allocations: {
          include: {
            sinkingFund: {
              select: {
                id: true,
                name: true,
              },
            },
            goal: {
              select: {
                id: true,
                name: true,
              },
            },
            emergencyFund: {
              select: {
                id: true,
                amount: true,
                type: true,
              },
            },
          },
        },
      },
    });

    if (!batch) {
      throw new NotFoundException(`Allocation ${id} not found`);
    }

    return batch;
  }
}
