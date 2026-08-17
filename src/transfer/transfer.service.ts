import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TransactionType } from '@prisma/client';

import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balanceService: BalanceService,
  ) {}

  async create(userId: string, dto: CreateTransferDto) {
    const amount = new Prisma.Decimal(dto.amount);

    if (amount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (amount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    if (dto.sourceBookId === dto.targetBookId) {
      throw new BadRequestException(
        'Source and target books must be different',
      );
    }

    const transferDate = dto.date ? new Date(dto.date) : new Date();

    return this.prisma.$transaction(async (tx) => {
      const books = await tx.$queryRaw<
        {
          id: string;
          name: string;
          userId: string;
          currency: string;
          bookTotalAmount: Prisma.Decimal;
        }[]
      >`
        SELECT
          id,
          name,
          "userId",
          currency,
          "bookTotalAmount"
        FROM "Book"
        WHERE id IN (${Prisma.join([dto.sourceBookId, dto.targetBookId])})
          AND "userId" = ${userId}
          FOR UPDATE
      `;

      const sourceBook = books.find((book) => book.id === dto.sourceBookId);

      const targetBook = books.find((book) => book.id === dto.targetBookId);

      if (!sourceBook) {
        throw new NotFoundException(
          `Source book ${dto.sourceBookId} not found`,
        );
      }

      if (!targetBook) {
        throw new NotFoundException(
          `Target book ${dto.targetBookId} not found`,
        );
      }

      if (sourceBook.currency !== targetBook.currency) {
        throw new BadRequestException(
          'Transfers between books with different currencies are not supported',
        );
      }

      const sourceBalance = new Prisma.Decimal(sourceBook.bookTotalAmount);

      if (sourceBalance.lt(amount)) {
        throw new BadRequestException(
          `Insufficient balance in ${sourceBook.name}. ` +
            `Available balance: ${sourceBalance.toFixed(2)}`,
        );
      }

      const sourceTransaction = await tx.transaction.create({
        data: {
          bookId: sourceBook.id,
          type: TransactionType.EXPENSE,
          amount,
          date: transferDate,
          remark: dto.remark?.trim() || `Transfer to ${targetBook.name}`,
        },
      });

      const targetTransaction = await tx.transaction.create({
        data: {
          bookId: targetBook.id,
          type: TransactionType.INCOME,
          amount,
          date: transferDate,
          remark: dto.remark?.trim() || `Transfer from ${sourceBook.name}`,
        },
      });

      const transfer = await tx.transfer.create({
        data: {
          userId,
          sourceBookId: sourceBook.id,
          targetBookId: targetBook.id,
          amount,
          date: transferDate,
          remark: dto.remark?.trim() || null,
          sourceTransactionId: sourceTransaction.id,
          targetTransactionId: targetTransaction.id,
        },
        include: {
          sourceBook: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
          targetBook: {
            select: {
              id: true,
              name: true,
              currency: true,
            },
          },
        },
      });

      await this.balanceService.updateBookBalance(tx, sourceBook.id);

      await this.balanceService.updateBookBalance(tx, targetBook.id);

      return {
        id: transfer.id,
        sourceBook: transfer.sourceBook,
        targetBook: transfer.targetBook,
        amount: transfer.amount.toFixed(2),
        date: transfer.date,
        remark: transfer.remark,
      };
    });
  }

  async findAll(userId: string, bookId?: string) {
    const where: Prisma.TransferWhereInput = {
      userId,
    };

    if (bookId) {
      where.OR = [
        {
          sourceBookId: bookId,
        },
        {
          targetBookId: bookId,
        },
      ];
    }

    return this.prisma.transfer.findMany({
      where,
      orderBy: {
        date: 'desc',
      },
      include: {
        sourceBook: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        targetBook: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const transfer = await this.prisma.transfer.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        sourceBook: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        targetBook: {
          select: {
            id: true,
            name: true,
            currency: true,
          },
        },
        sourceTransaction: {
          select: {
            id: true,
            type: true,
            amount: true,
            date: true,
            remark: true,
          },
        },
        targetTransaction: {
          select: {
            id: true,
            type: true,
            amount: true,
            date: true,
            remark: true,
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with id ${id} not found`);
    }

    return transfer;
  }

  async remove(userId: string, id: string) {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const transfer = await tx.transfer.findFirst({
        where: {
          id,
          userId,
        },
        select: {
          id: true,
          sourceBookId: true,
          targetBookId: true,
          sourceTransactionId: true,
          targetTransactionId: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException(`Transfer with id ${id} not found`);
      }

      if (transfer.sourceTransactionId) {
        await tx.transaction.delete({
          where: {
            id: transfer.sourceTransactionId,
          },
        });
      }

      if (transfer.targetTransactionId) {
        await tx.transaction.delete({
          where: {
            id: transfer.targetTransactionId,
          },
        });
      }

      await tx.transfer.delete({
        where: {
          id: transfer.id,
        },
      });

      if (transfer.sourceBookId) {
        await this.balanceService.updateBookBalance(tx, transfer.sourceBookId);
      }

      if (
        transfer.targetBookId &&
        transfer.targetBookId !== transfer.sourceBookId
      ) {
        await this.balanceService.updateBookBalance(tx, transfer.targetBookId);
      }

      return {
        id: transfer.id,
        message: 'Transfer deleted successfully',
      };
    });
  }
}
