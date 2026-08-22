import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { Prisma, TransactionType } from '@prisma/client';
import dayjs from 'dayjs';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async updateBookBalance(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<void> {
    const { balance } = await this.getBookBalanceWithTx(tx, bookId);

    await tx.book.update({
      where: { id: bookId },
      data: {
        bookTotalAmount: balance,
        updatedAt: dayjs().toDate(),
      },
    });
  }

  async getBookBalanceWithTx(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<{ balance: number; totalCashIn: number; totalCashOut: number }> {
    const transactions = await tx.transaction.findMany({
      where: { bookId },
      select: {
        amount: true,
        type: true,
      },
    });

    const totalCashIn = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + new Prisma.Decimal(t.amount).toNumber(), 0);

    const totalCashOut = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + new Prisma.Decimal(t.amount).toNumber(), 0);

    const balance = totalCashIn - totalCashOut;

    return {
      balance,
      totalCashIn,
      totalCashOut,
    };
  }
}
