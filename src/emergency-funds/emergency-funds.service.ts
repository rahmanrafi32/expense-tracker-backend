import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import {
  CreateEmergencyFundsDto,
  EmergencyEntryType,
} from './dto/create-emergency-fund.dto';
import { TransactionType } from '../common';
import { Prisma } from '@prisma/client';

@Injectable()
export class EmergencyService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateEmergencyFundsDto) {
    const book = await this.prisma.book.findUnique({
      where: { id: dto.bookId },
    });
    if (!book) throw new NotFoundException('Book not found');

    if (dto.type === EmergencyEntryType.REPAYMENT) {
      const { netOwed } = await this.getSummary(dto.bookId);
      if (dto.amount > netOwed) {
        throw new BadRequestException(
          `Repayment of ${dto.amount} exceeds outstanding amount of ${netOwed}`,
        );
      }
    }

    const entryDate = dto.date ? new Date(dto.date) : new Date();

    const txType =
      dto.type === EmergencyEntryType.WITHDRAWAL
        ? TransactionType.EXPENSE
        : TransactionType.INCOME;

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const entry = await tx.emergencyFund.create({
        data: {
          bookId: dto.bookId,
          type: dto.type,
          amount: dto.amount,
          remark: dto.remark,
          category: dto.category ?? 'General',
          date: entryDate,
        },
      });

      await tx.transaction.create({
        data: {
          bookId: dto.bookId,
          type: txType,
          amount: dto.amount,
          remark: dto.remark,
          date: entryDate,
          emergencyFundId: entry.id,
        },
      });

      await this.updateBookBalance(tx, dto.bookId);

      return entry;
    });
  }

  async findAllByBook(bookId: string, cursor?: string, limit = 20) {
    const entries = await this.prisma.emergencyFund.findMany({
      where: { bookId },
      orderBy: { date: 'desc' },
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    });

    const hasNextPage = entries.length > limit;
    const data = hasNextPage ? entries.slice(0, -1) : entries;
    const nextCursor = hasNextPage ? data[data.length - 1].id : null;

    return { data, nextCursor };
  }

  async getSummary(bookId: string) {
    const totals = await this.prisma.emergencyFund.groupBy({
      by: ['type'],
      where: { bookId },
      _sum: { amount: true },
    });

    const totalBorrowed =
      totals.find((t) => t.type === 'WITHDRAWAL')?._sum?.amount ?? 0;
    const totalRepaid =
      totals.find((t) => t.type === 'REPAYMENT')?._sum?.amount ?? 0;
    const netOwed = totalBorrowed - totalRepaid;

    const lastWithdrawal = await this.prisma.emergencyFund.findFirst({
      where: { bookId, type: 'WITHDRAWAL' },
      orderBy: { date: 'desc' },
    });

    return { totalBorrowed, totalRepaid, netOwed, lastWithdrawal };
  }

  async remove(id: string) {
    const entry = await this.prisma.emergencyFund.findUnique({
      where: { id },
      include: { transaction: true },
    });
    if (!entry) throw new NotFoundException(`Emergency entry ${id} not found`);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (entry.transaction) {
        await tx.transaction.delete({ where: { id: entry.transaction.id } });
      }

      await tx.emergencyFund.delete({ where: { id } });

      await this.updateBookBalance(tx, entry.bookId);

      return { deleted: true };
    });
  }

  private async updateBookBalance(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<void> {
    const { balance } = await this.getBookBalanceWithTx(tx, bookId);

    await tx.book.update({
      where: { id: bookId },
      data: {
        bookTotalAmount: balance,
        updatedAt: new Date(),
      },
    });
  }

  private async getBookBalanceWithTx(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<{ balance: number }> {
    const transactions = await tx.transaction.findMany({
      where: { bookId },
      select: {
        amount: true,
        type: true,
      },
    });

    const totalCashIn = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalCashOut = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      balance: totalCashIn - totalCashOut,
    };
  }
}
