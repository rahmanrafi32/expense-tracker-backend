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
    // Lock before reading the ledger so a concurrent cash movement cannot
    // overwrite the book with a balance calculated before it committed.
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "Book" WHERE "id" = ${bookId} FOR NO KEY UPDATE`,
    );
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
  ): Promise<{
    balance: Prisma.Decimal;
    totalCashIn: Prisma.Decimal;
    totalCashOut: Prisma.Decimal;
  }> {
    const transactions = await tx.transaction.findMany({
      where: { bookId },
      select: {
        amount: true,
        type: true,
      },
    });

    const totalCashIn = transactions
      .filter((t) => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0));

    const totalCashOut = transactions
      .filter((t) => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum.plus(t.amount), new Prisma.Decimal(0));

    const balance = totalCashIn.minus(totalCashOut);

    return {
      balance,
      totalCashIn,
      totalCashOut,
    };
  }
}
