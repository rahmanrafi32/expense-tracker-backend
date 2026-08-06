import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateGoal } from './dto/create-goal';
import dayjs from 'dayjs';
import { CreateGoalDepositDto } from './dto/create-goal-deposit';

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateGoal) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });
    if (!book) throw new NotFoundException('Book not found');

    return this.prisma.goal.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        deadline: new Date(dto.deadline),
        icon: dto.icon ?? 'target',
      },
      include: { deposits: true },
    });
  }

  async findAllByBook(bookId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { bookId },
      orderBy: { deadline: 'asc' },
      include: { deposits: { orderBy: { date: 'desc' } } },
    });

    const now = dayjs();
    return goals.map((g) => {
      const monthsLeft = Math.max(
        0,
        dayjs(g.deadline).diff(now, 'month', true),
      );
      const remaining = g.targetAmount - g.savedAmount;
      const monthlyNeeded =
        monthsLeft > 0 && remaining > 0 ? Math.ceil(remaining / monthsLeft) : 0;
      return {
        ...g,
        progressPct: Math.round((g.savedAmount / g.targetAmount) * 100),
        remaining,
        monthlyNeeded,
        monthsLeft: Math.ceil(monthsLeft),
      };
    });
  }

  async findOne(id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { deposits: { orderBy: { date: 'desc' } } },
    });
    if (!goal) throw new NotFoundException(`Goal ${id} not found`);
    return goal;
  }

  async update(id: string, dto: Partial<CreateGoal>) {
    await this.findOne(id);
    return this.prisma.goal.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.targetAmount && { targetAmount: dto.targetAmount }),
        ...(dto.deadline && { deadline: new Date(dto.deadline) }),
        ...(dto.icon && { icon: dto.icon }),
      },
      include: { deposits: true },
    });
  }

  async addDeposit(goalId: string, dto: CreateGoalDepositDto) {
    const goal = await this.findOne(goalId);

    if (goal.savedAmount + dto.amount > goal.targetAmount) {
      throw new BadRequestException(
        `Deposit of ${dto.amount} would exceed goal target of ${goal.targetAmount}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.goalDeposit.create({
        data: {
          goalId,
          amount: dto.amount,
          note: dto.note,
          date: dto.date ? new Date(dto.date) : new Date(),
        },
      });

      await tx.goal.update({
        where: { id: goalId },
        data: { savedAmount: { increment: dto.amount } },
      });

      return deposit;
    });
  }

  async removeDeposit(depositId: string) {
    const deposit = await this.prisma.goalDeposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) throw new NotFoundException(`Deposit ${depositId} not found`);

    return this.prisma.$transaction(async (tx) => {
      await tx.goalDeposit.delete({ where: { id: depositId } });
      await tx.goal.update({
        where: { id: deposit.goalId },
        data: { savedAmount: { decrement: deposit.amount } },
      });
      return { deleted: true };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.goal.delete({ where: { id } });
  }
}
