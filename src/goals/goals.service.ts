import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

import { PrismaService } from '../database/prisma.service';
import { CreateGoalDto } from './dto/create-goal';
import { UpdateGoalDto } from './dto/update-goal';
import { CreateGoalDepositDto } from './dto/create-goal-deposit';
import { getRemainingDuration } from '../utils/date-duration';

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateGoalDto) {
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
      throw new NotFoundException(`Book ${dto.bookId} not found`);
    }

    const goal = await this.prisma.goal.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        targetAmount: new Prisma.Decimal(dto.targetAmount),
        savedAmount: new Prisma.Decimal(0),
        deadline: new Date(dto.deadline),
        icon: dto.icon ?? 'target',
      },
      include: {
        deposits: true,
      },
    });

    return this.serializeGoal(goal);
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

    const goals = await this.prisma.goal.findMany({
      where: {
        bookId,
      },
      orderBy: {
        deadline: 'asc',
      },
      include: {
        deposits: {
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    const now = dayjs().startOf('day');

    return goals.map((goal) => {
      const { exactMonths, months, days } = getRemainingDuration(
        now,
        dayjs(goal.deadline).startOf('day'),
      );

      const difference = goal.targetAmount.minus(goal.savedAmount);

      const remaining = difference.gt(0) ? difference : new Prisma.Decimal(0);

      const monthlyNeeded =
        exactMonths > 0 && remaining.gt(0)
          ? remaining.div(exactMonths).ceil()
          : new Prisma.Decimal(0);

      const progressPct = goal.targetAmount.gt(0)
        ? Math.min(
            100,
            goal.savedAmount.div(goal.targetAmount).mul(100).round().toNumber(),
          )
        : 0;

      return {
        ...this.serializeGoal(goal),
        progressPct,
        remaining: remaining.toFixed(2),
        monthlyNeeded: monthlyNeeded.toFixed(2),
        monthsLeft: months,
        daysLeft: days,
      };
    });
  }

  async findOne(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        book: {
          userId,
        },
      },
      include: {
        deposits: {
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    return this.serializeGoal(goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    if (dto.targetAmount !== undefined) {
      const newTargetAmount = dto.targetAmount;
      return this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<
          {
            id: string;
            targetAmount: Prisma.Decimal;
            savedAmount: Prisma.Decimal;
          }[]
        >`
          SELECT
            g.id,
            g."targetAmount",
            g."savedAmount"
          FROM "Goal" g
                 INNER JOIN "Book" b
                            ON b.id = g."bookId"
          WHERE g.id = ${id}
            AND b."userId" = ${userId}
            FOR UPDATE OF g
        `;

        const goal = rows[0];

        if (!goal) {
          throw new NotFoundException(`Goal ${id} not found`);
        }

        const targetAmount = new Prisma.Decimal(newTargetAmount);

        if (targetAmount.lt(goal.savedAmount)) {
          throw new BadRequestException(
            `Target amount cannot be less than the current saved amount of ${goal.savedAmount.toFixed(2)}`,
          );
        }

        const updatedGoal = await tx.goal.update({
          where: {
            id,
          },
          data: {
            ...(dto.name !== undefined && {
              name: dto.name,
            }),

            targetAmount,

            ...(dto.deadline !== undefined && {
              deadline: new Date(dto.deadline),
            }),

            ...(dto.icon !== undefined && {
              icon: dto.icon,
            }),
          },
          include: {
            deposits: {
              orderBy: {
                date: 'desc',
              },
            },
          },
        });

        return this.serializeGoal(updatedGoal);
      });
    }

    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        book: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    const updatedGoal = await this.prisma.goal.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name,
        }),

        ...(dto.deadline !== undefined && {
          deadline: new Date(dto.deadline),
        }),

        ...(dto.icon !== undefined && {
          icon: dto.icon,
        }),
      },
      include: {
        deposits: {
          orderBy: {
            date: 'desc',
          },
        },
      },
    });

    return this.serializeGoal(updatedGoal);
  }

  async addDeposit(userId: string, goalId: string, dto: CreateGoalDepositDto) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        {
          id: string;
          targetAmount: Prisma.Decimal;
          savedAmount: Prisma.Decimal;
        }[]
      >`
        SELECT
          g.id,
          g."targetAmount",
          g."savedAmount"
        FROM "Goal" g
               INNER JOIN "Book" b
                          ON b.id = g."bookId"
        WHERE g.id = ${goalId}
          AND b."userId" = ${userId}
          FOR UPDATE OF g
      `;

      const goal = rows[0];

      if (!goal) {
        throw new NotFoundException(`Goal ${goalId} not found`);
      }

      const amount = new Prisma.Decimal(dto.amount);

      const newSavedAmount = goal.savedAmount.add(amount);

      if (newSavedAmount.gt(goal.targetAmount)) {
        throw new BadRequestException(
          `Deposit of ${amount.toFixed(2)} would exceed goal target of ${goal.targetAmount.toFixed(2)}`,
        );
      }

      const deposit = await tx.goalDeposit.create({
        data: {
          goalId,
          amount,
          note: dto.note,
          date: dto.date ? new Date(dto.date) : new Date(),
        },
      });

      await tx.goal.update({
        where: {
          id: goalId,
        },
        data: {
          savedAmount: {
            increment: amount,
          },
        },
      });

      return {
        ...deposit,
        amount: deposit.amount.toFixed(2),
      };
    });
  }

  async removeDeposit(userId: string, depositId: string) {
    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.goalDeposit.findFirst({
        where: {
          id: depositId,
          goal: {
            book: {
              userId,
            },
          },
        },
        select: {
          id: true,
          goalId: true,
          amount: true,
        },
      });

      if (!deposit) {
        throw new NotFoundException(`Deposit ${depositId} not found`);
      }

      await tx.$queryRaw`
        SELECT id
        FROM "Goal"
        WHERE id = ${deposit.goalId}
        FOR UPDATE
      `;

      await tx.goalDeposit.delete({
        where: {
          id: depositId,
        },
      });

      await tx.goal.update({
        where: {
          id: deposit.goalId,
        },
        data: {
          savedAmount: {
            decrement: deposit.amount,
          },
        },
      });

      return {
        deleted: true,
      };
    });
  }

  async remove(userId: string, id: string) {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        book: {
          userId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    await this.prisma.goal.delete({
      where: {
        id,
      },
    });

    return {
      deleted: true,
    };
  }

  private serializeGoal<
    T extends {
      targetAmount: Prisma.Decimal;
      savedAmount: Prisma.Decimal;
      deposits: Array<{
        amount: Prisma.Decimal;
      }>;
    },
  >(goal: T) {
    return {
      ...goal,
      targetAmount: goal.targetAmount.toFixed(2),
      savedAmount: goal.savedAmount.toFixed(2),
      deposits: goal.deposits.map((deposit) => ({
        ...deposit,
        amount: deposit.amount.toFixed(2),
      })),
    };
  }
}
