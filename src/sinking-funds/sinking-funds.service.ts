import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateSinkingFundDto } from './dto/create-sinking-fund.dto';
import { UpdateSinkingFundDto } from './dto/update-sinking-fund.dto';
import { CreateSinkingFundDepositDto } from './dto/create-sinking-fund-deposit.dto';
import { Prisma } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class SinkingFundService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSinkingFundDto) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });
    if (!book) throw new NotFoundException('Book not found');

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

    return this.prisma.sinkingFund.create({
      data: {
        bookId: dto.bookId,
        name: dto.name,
        targetAmount: dto.targetAmount,
        deadline: new Date(dto.deadline),
        categoryId: category.id,
      },
      include: {
        deposits: true,
        category: { select: { id: true, name: true } },
      },
    });
  }

  async findAllByBook(bookId: string) {
    const funds = await this.prisma.sinkingFund.findMany({
      where: { bookId },
      orderBy: { deadline: 'asc' },
      include: {
        deposits: { orderBy: { date: 'desc' } },
        category: { select: { id: true, name: true } },
      },
    });

    const now = dayjs();
    return funds.map((f) => {
      const exactMonthsLeft = dayjs(f.deadline).diff(now, 'month', true);
      const wholeMonthsLeft = Math.max(1, Math.ceil(exactMonthsLeft));

      const remaining = f.targetAmount - f.savedAmount;
      const monthlyNeeded =
        remaining > 0 ? Math.ceil(remaining / wholeMonthsLeft) : 0;

      return {
        ...f,
        progressPct:
          f.targetAmount > 0
            ? Math.round((f.savedAmount / f.targetAmount) * 100)
            : 0,
        remaining,
        monthlyNeeded,
        monthsLeft: wholeMonthsLeft,
      };
    });
  }

  async findOne(id: string) {
    const fund = await this.prisma.sinkingFund.findUnique({
      where: { id },
      include: { deposits: { orderBy: { date: 'desc' } } },
    });
    if (!fund) throw new NotFoundException(`Sinking fund ${id} not found`);
    return fund;
  }

  async update(id: string, dto: UpdateSinkingFundDto) {
    await this.findOne(id);
    return this.prisma.sinkingFund.update({
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

  async addDeposit(fundId: string, dto: CreateSinkingFundDepositDto) {
    const fund = await this.findOne(fundId);

    if (fund.savedAmount + dto.amount > fund.targetAmount) {
      throw new BadRequestException(
        `Deposit of ${dto.amount} exceeds the remaining target of ${fund.targetAmount - fund.savedAmount}`,
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deposit = await tx.sinkingFundDeposit.create({
        data: {
          sinkingFundId: fundId,
          amount: dto.amount,
          note: dto.note,
          date: dto.date ? new Date(dto.date) : new Date(),
        },
      });

      await tx.sinkingFund.update({
        where: { id: fundId },
        data: { savedAmount: { increment: dto.amount } },
      });

      return deposit;
    });
  }

  async removeDeposit(depositId: string) {
    const deposit = await this.prisma.sinkingFundDeposit.findUnique({
      where: { id: depositId },
    });
    if (!deposit) throw new NotFoundException(`Deposit ${depositId} not found`);

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
    return this.prisma.sinkingFund.delete({ where: { id } });
  }
}
