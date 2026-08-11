import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmergencyFundType, Prisma, TransactionType } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import {
  CreateEmergencyFundsDto,
  EmergencyEntryType,
} from './dto/create-emergency-fund.dto';

@Injectable()
export class EmergencyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateEmergencyFundsDto) {
    return this.prisma.$transaction(async (tx) => {
      const books = await tx.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Book"
        WHERE id = ${dto.bookId}
          AND "userId" = ${userId}
          FOR UPDATE
      `;

      const book = books[0];

      if (!book) {
        throw new NotFoundException(`Book ${dto.bookId} not found`);
      }

      const category = await tx.category.findFirst({
        where: {
          id: dto.categoryId,
          OR: [
            {
              userId,
            },
            {
              userId: null,
              isSystem: true,
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (!category) {
        throw new NotFoundException(`Category ${dto.categoryId} not found`);
      }

      const paymentMethod = await tx.paymentMethod.findFirst({
        where: {
          id: dto.paymentMethodId,
          OR: [
            {
              userId,
            },
            {
              userId: null,
              isDefault: true,
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (!paymentMethod) {
        throw new NotFoundException(
          `Payment method ${dto.paymentMethodId} not found`,
        );
      }

      const amount = new Prisma.Decimal(dto.amount);

      if (dto.type === EmergencyEntryType.REPAYMENT) {
        const totals = await tx.emergencyFund.groupBy({
          by: ['type'],
          where: {
            bookId: dto.bookId,
          },
          _sum: {
            amount: true,
          },
        });

        const totalBorrowed =
          totals.find((item) => item.type === 'WITHDRAWAL')?._sum.amount ??
          new Prisma.Decimal(0);

        const totalRepaid =
          totals.find((item) => item.type === 'REPAYMENT')?._sum.amount ??
          new Prisma.Decimal(0);

        const netOwed = totalBorrowed.minus(totalRepaid);

        if (amount.gt(netOwed)) {
          throw new BadRequestException(
            `Repayment of ${amount.toFixed(
              2,
            )} exceeds outstanding amount of ${netOwed.toFixed(2)}`,
          );
        }
      }

      const entryDate = dto.date ? new Date(dto.date) : new Date();

      const transactionType =
        dto.type === EmergencyEntryType.WITHDRAWAL
          ? TransactionType.EXPENSE
          : TransactionType.INCOME;

      const entry = await tx.emergencyFund.create({
        data: {
          bookId: dto.bookId,
          categoryId: dto.categoryId,
          paymentMethodId: dto.paymentMethodId,
          type: dto.type,
          amount,
          remark: dto.remark,
          date: entryDate,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              isIncome: true,
              isSystem: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      await tx.transaction.create({
        data: {
          bookId: dto.bookId,
          type: transactionType,
          amount,
          remark: dto.remark,
          date: entryDate,
          categoryId: dto.categoryId,
          paymentMethodId: dto.paymentMethodId,
          emergencyFundId: entry.id,
        },
      });

      await this.updateBookBalance(tx, dto.bookId);

      return this.serializeEntry(entry);
    });
  }

  async findAllByBook(
    userId: string,
    bookId: string,
    cursor?: string,
    limit = 20,
  ) {
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

    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const entries = await this.prisma.emergencyFund.findMany({
      where: {
        bookId,
      },
      orderBy: {
        date: 'desc',
      },
      take: safeLimit + 1,

      ...(cursor
        ? {
            cursor: {
              id: cursor,
            },
            skip: 1,
          }
        : {}),

      include: {
        category: {
          select: {
            id: true,
            name: true,
            isIncome: true,
            isSystem: true,
          },
        },
        paymentMethod: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    const hasNextPage = entries.length > safeLimit;

    const data = hasNextPage ? entries.slice(0, -1) : entries;

    const nextCursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;

    return {
      data: data.map((entry) => this.serializeEntry(entry)),
      nextCursor,
    };
  }

  async getSummary(userId: string, bookId: string) {
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

    const totals = await this.prisma.emergencyFund.groupBy({
      by: ['type'],
      where: {
        bookId,
      },
      _sum: {
        amount: true,
      },
    });

    const totalBorrowed =
      totals.find((item) => item.type === 'WITHDRAWAL')?._sum.amount ??
      new Prisma.Decimal(0);

    const totalRepaid =
      totals.find((item) => item.type === 'REPAYMENT')?._sum.amount ??
      new Prisma.Decimal(0);

    const netOwed = totalBorrowed.minus(totalRepaid);

    const lastWithdrawal = await this.prisma.emergencyFund.findFirst({
      where: {
        bookId,
        type: EmergencyEntryType.WITHDRAWAL,
      },
      orderBy: {
        date: 'desc',
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            isIncome: true,
            isSystem: true,
          },
        },
        paymentMethod: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return {
      totalBorrowed: totalBorrowed.toFixed(2),

      totalRepaid: totalRepaid.toFixed(2),

      netOwed: netOwed.toFixed(2),

      lastWithdrawal: lastWithdrawal
        ? this.serializeEntry(lastWithdrawal)
        : null,
    };
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const entries = await tx.$queryRaw<
        {
          id: string;
          bookId: string;
          transactionId: string | null;
        }[]
      >`
        SELECT ef.id,
               ef."bookId",
               t.id AS "transactionId"
        FROM "EmergencyFund" ef
               INNER JOIN "Book" b
                          ON b.id = ef."bookId"
               LEFT JOIN "Transaction" t
                         ON t."emergencyFundId" = ef.id
        WHERE ef.id = ${id}
          AND b."userId" = ${userId}
          FOR UPDATE OF ef, b
      `;

      const entry = entries[0];

      if (!entry) {
        throw new NotFoundException(`Emergency entry ${id} not found`);
      }

      if (entry.transactionId) {
        await tx.transaction.delete({
          where: {
            id: entry.transactionId,
          },
        });
      }

      await tx.emergencyFund.delete({
        where: {
          id,
        },
      });

      await this.updateBookBalance(tx, entry.bookId);

      return {
        deleted: true,
      };
    });
  }

  private async updateBookBalance(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<void> {
    const { balance } = await this.getBookBalanceWithTx(tx, bookId);

    await tx.book.update({
      where: {
        id: bookId,
      },
      data: {
        bookTotalAmount: balance,
        updatedAt: new Date(),
      },
    });
  }

  private async getBookBalanceWithTx(
    tx: Prisma.TransactionClient,
    bookId: string,
  ): Promise<{
    balance: Prisma.Decimal;
  }> {
    const transactions = await tx.transaction.findMany({
      where: {
        bookId,
      },
      select: {
        amount: true,
        type: true,
      },
    });

    let totalCashIn = new Prisma.Decimal(0);

    let totalCashOut = new Prisma.Decimal(0);

    for (const transaction of transactions) {
      if (transaction.type === 'INCOME') {
        totalCashIn = totalCashIn.add(transaction.amount);
      } else if (transaction.type === 'EXPENSE') {
        totalCashOut = totalCashOut.add(transaction.amount);
      }
    }

    return {
      balance: totalCashIn.minus(totalCashOut),
    };
  }

  private serializeEntry(entry: {
    id: string;
    bookId: string;
    categoryId: string;
    paymentMethodId: string;
    type: EmergencyFundType;
    amount: Prisma.Decimal;
    remark: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
    category: {
      id: string;
      name: string;
      isIncome: boolean;
      isSystem: boolean;
    };
    paymentMethod: {
      id: string;
      name: string;
    };
  }) {
    return {
      id: entry.id,
      bookId: entry.bookId,
      type: entry.type,
      amount: entry.amount.toFixed(2),
      remark: entry.remark,
      date: entry.date,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      category: entry.category,
      paymentMethod: entry.paymentMethod,
    };
  }
}
