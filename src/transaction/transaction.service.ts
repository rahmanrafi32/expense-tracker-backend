import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionType } from './enums/transaction-type.enum';
import { Prisma, Transaction } from '@prisma/client';
import { BalanceService } from '../balance/balance.service';

type TransactionUpdateData = {
  type?: TransactionType;
  remark?: string;
  date?: Date;
  amount?: number;
  categoryId?: string;
  paymentMethodId?: string;
};

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
  ) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const bookExists = await this.prisma.book.findUnique({
      where: { id: createTransactionDto.bookId },
      include: { user: true },
    });

    if (!bookExists) {
      throw new NotFoundException(`Book not found`);
    }

    // Validate amount
    if (
      createTransactionDto.amount !== undefined &&
      createTransactionDto.amount < 0
    ) {
      throw new BadRequestException('Amount cannot be negative');
    }

    let category = await this.prisma.category.findFirst({
      where: {
        name: createTransactionDto.category,
        OR: [{ userId: bookExists.userId }, { isDefault: true, userId: null }],
      },
    });

    if (!category) {
      category = await this.prisma.category.create({
        data: {
          name: createTransactionDto.category,
          userId: bookExists.userId,
        },
      });
    }

    let paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: createTransactionDto.paymentMethod,
        OR: [{ userId: bookExists.userId }, { isDefault: true, userId: null }],
      },
    });

    if (!paymentMethod) {
      paymentMethod = await this.prisma.paymentMethod.create({
        data: {
          name: createTransactionDto.paymentMethod,
          userId: bookExists.userId,
        },
      });
    }

    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const newTransaction = await tx.transaction.create({
            data: {
              bookId: createTransactionDto.bookId,
              type: createTransactionDto.type,
              date: new Date(createTransactionDto.date),
              amount: createTransactionDto.amount || 0.0,
              remark: createTransactionDto.remark,
              categoryId: category.id,
              paymentMethodId: paymentMethod.id,
            },
            include: {
              book: {
                select: {
                  name: true,
                  user: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              category: {
                select: {
                  id: true,
                  name: true,
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

          await this.balanceService.updateBookBalance(
            tx,
            createTransactionDto.bookId,
          );

          return newTransaction;
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException('Invalid book ID provided');
      }
      throw error;
    }
  }

  async findAllByBook(bookId: string, cursor?: string, limit = 10) {
    const [transactions, totals] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where: { bookId },
        orderBy: { date: 'desc' },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        include: {
          category: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: { bookId },
        orderBy: { type: 'asc' },
        _sum: { amount: true },
      }),
    ]);

    const hasNextPage = transactions.length > limit;
    const data = hasNextPage ? transactions.slice(0, -1) : transactions;
    const nextCursor = hasNextPage ? data[data.length - 1].id : null;

    const totalIncome =
      totals.find((t) => t.type === 'INCOME')?._sum?.amount ?? 0;
    const totalExpense =
      totals.find((t) => t.type === 'EXPENSE')?._sum?.amount ?? 0;

    return { data, nextCursor, totalIncome, totalExpense };
  }

  async findOne(id: string): Promise<
    Prisma.TransactionGetPayload<{
      include: {
        category: { select: { id: true; name: true } };
        paymentMethod: { select: { id: true; name: true } };
      };
    }>
  > {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
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
    if (!transaction) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }
    return transaction;
  }

  async update(id: string, updateTransactionDto: UpdateTransactionDto) {
    const existingTransaction = await this.prisma.transaction.findUnique({
      where: { id },
      include: { book: { include: { user: true } } },
    });

    if (!existingTransaction) {
      throw new NotFoundException(`Transaction with id ${id} not found`);
    }

    if (
      updateTransactionDto.amount !== undefined &&
      updateTransactionDto.amount < 0
    ) {
      throw new BadRequestException('Amount cannot be negative');
    }

    const updateData: TransactionUpdateData = {
      type: updateTransactionDto.type,
      remark: updateTransactionDto.remark,
      date: updateTransactionDto.date
        ? new Date(updateTransactionDto.date)
        : undefined,
      amount: updateTransactionDto.amount,
    };

    // Handle category update
    if (updateTransactionDto.category) {
      let category = await this.prisma.category.findFirst({
        where: {
          name: updateTransactionDto.category,
          OR: [
            { userId: existingTransaction.book.userId },
            { isDefault: true, userId: null },
          ],
        },
      });

      if (!category) {
        category = await this.prisma.category.create({
          data: {
            name: updateTransactionDto.category,
            userId: existingTransaction.book.userId,
          },
        });
      }

      updateData.categoryId = category.id;
    }

    // Handle payment method update
    if (updateTransactionDto.paymentMethod) {
      let paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          name: updateTransactionDto.paymentMethod,
          OR: [
            { userId: existingTransaction.book.userId },
            { isDefault: true, userId: null },
          ],
        },
      });

      if (!paymentMethod) {
        paymentMethod = await this.prisma.paymentMethod.create({
          data: {
            name: updateTransactionDto.paymentMethod,
            userId: existingTransaction.book.userId,
          },
        });
      }

      updateData.paymentMethodId = paymentMethod.id;
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedTransaction = await tx.transaction.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          paymentMethod: {
            select: {
              id: true,
              name: true,
            },
          },
          book: {
            select: {
              name: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      });
      await this.balanceService.updateBookBalance(
        tx,
        existingTransaction.bookId,
      );

      return updatedTransaction;
    });
  }

  async remove(id: string): Promise<Transaction> {
    const transaction = await this.findOne(id);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deletedTransaction = await tx.transaction.delete({
        where: { id },
      });
      await this.balanceService.updateBookBalance(tx, transaction.bookId);
      return deletedTransaction;
    });
  }
}
