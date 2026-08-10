import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

import { PrismaService } from '../database/prisma.service';
import { getRemainingDuration } from '../utils/date-duration';
import { CreateSinkingFundDto } from './dto/create-sinking-fund.dto';
import { UpdateSinkingFundDto } from './dto/update-sinking-fund.dto';
import { CreateSinkingFundDepositDto } from './dto/create-sinking-fund-deposit.dto';

@Injectable()
export class SinkingFundService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSinkingFundDto) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });

    if (!book) {
      throw new NotFoundException('Book not found');
    }

    let category = await this.prisma.category.findFirst({
      where: {
        name: dto.category,
        OR: [{ userId: book.userId }, { isDefault: true, userId: null }],
      },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: { name: dto.category, userId: book.userId },
      });
    }

    const fund = await this.prisma.sinkingFund.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        targetAmount: new Prisma.Decimal(dto.targetAmount),
        savedAmount: new Prisma.Decimal(0),
        deadline: new Date(dto.deadline),
        categoryId: category.id,
      },
      include: {
        deposits: true,
        category: { select: { id: true, name: true } },
      },
    });

    return this.serializeFund(fund);
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

    const funds = await this.prisma.sinkingFund.findMany({
      where: { bookId },
      orderBy: { deadline: 'asc' },
      include: {
        deposits: { orderBy: { date: 'desc' } },
        category: { select: { id: true, name: true } },
      },
    });

    const now = dayjs().startOf('day');

    return funds.map((fund) => {
      const { exactMonths, months, days } = getRemainingDuration(
        now,
        dayjs(fund.deadline).startOf('day'),
      );
      const difference = fund.targetAmount.minus(fund.savedAmount);
      const remaining = difference.gt(0) ? difference : new Prisma.Decimal(0);
      const monthlyNeeded =
        exactMonths > 0 && remaining.gt(0)
          ? remaining.div(exactMonths).ceil()
          : new Prisma.Decimal(0);

      const progressPct = fund.targetAmount.gt(0)
        ? Math.min(
            100,
            fund.savedAmount.div(fund.targetAmount).mul(100).round().toNumber(),
          )
        : 0;

      return {
        ...this.serializeFund(fund),
        progressPct,
        remaining: remaining.toFixed(2),
        monthlyNeeded: monthlyNeeded.toFixed(2),
        monthsLeft: months,
        daysLeft: days,
      };
    });
  }

  async findOne(id: string) {
    const fund = await this.prisma.sinkingFund.findUnique({
      where: { id },
      include: {
        deposits: { orderBy: { date: 'desc' } },
        category: { select: { id: true, name: true } },
      },
    });

    if (!fund) {
      throw new NotFoundException(`Sinking fund ${id} not found`);
    }

    return this.serializeFund(fund);
  }

  async update(id: string, dto: UpdateSinkingFundDto) {
    const currentFund = await this.findOne(id);

    if (dto.targetAmount !== undefined) {
      const targetAmount = new Prisma.Decimal(dto.targetAmount);
      const savedAmount = new Prisma.Decimal(currentFund.savedAmount);

      if (targetAmount.lt(savedAmount)) {
        throw new BadRequestException(
          `Target amount cannot be less than the current saved amount of ${savedAmount.toFixed(2)}`,
        );
      }
    }

    const fund = await this.prisma.sinkingFund.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetAmount !== undefined && {
          targetAmount: new Prisma.Decimal(dto.targetAmount),
        }),
        ...(dto.deadline !== undefined && {
          deadline: new Date(dto.deadline),
        }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
      },
      include: {
        deposits: { orderBy: { date: 'desc' } },
        category: { select: { id: true, name: true } },
      },
    });

    return this.serializeFund(fund);
  }

  async addDeposit(fundId: string, dto: CreateSinkingFundDepositDto) {
    const fund = await this.findOne(fundId);
    const amount = new Prisma.Decimal(dto.amount);
    const newSavedAmount = new Prisma.Decimal(fund.savedAmount).add(amount);
    const targetAmount = new Prisma.Decimal(fund.targetAmount);

    if (newSavedAmount.gt(targetAmount)) {
      throw new BadRequestException(
        `Deposit of ${amount.toFixed(2)} exceeds the remaining target of ${targetAmount
          .minus(new Prisma.Decimal(fund.savedAmount))
          .toFixed(2)}`,
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deposit = await tx.sinkingFundDeposit.create({
        data: {
          sinkingFundId: fundId,
          amount,
          note: dto.note,
          date: dto.date ? new Date(dto.date) : new Date(),
        },
      });

      await tx.sinkingFund.update({
        where: { id: fundId },
        data: { savedAmount: { increment: amount } },
      });

      return { ...deposit, amount: deposit.amount.toFixed(2) };
    });
  }

  async removeDeposit(depositId: string) {
    const deposit = await this.prisma.sinkingFundDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit ${depositId} not found`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.sinkingFundDeposit.delete({ where: { id: depositId } });
      await tx.sinkingFund.update({
        where: { id: deposit.sinkingFundId },
        data: { savedAmount: { decrement: deposit.amount } },
      });
      return { deleted: true };
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.sinkingFund.delete({ where: { id } });
    return { deleted: true };
  }

  private serializeFund<
    T extends {
      targetAmount: Prisma.Decimal;
      savedAmount: Prisma.Decimal;
      deposits: Array<{ amount: Prisma.Decimal }>;
    },
  >(fund: T) {
    return {
      ...fund,
      targetAmount: fund.targetAmount.toFixed(2),
      savedAmount: fund.savedAmount.toFixed(2),
      deposits: fund.deposits.map((deposit) => ({
        ...deposit,
        amount: deposit.amount.toFixed(2),
      })),
    };
  }
}
