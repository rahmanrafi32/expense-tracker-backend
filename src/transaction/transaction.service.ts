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
  amount?: string | Prisma.Decimal;
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

    const decimalAmount = new Prisma.Decimal(createTransactionDto.amount);

    if (decimalAmount.isNegative()) {
      throw new BadRequestException('Amount cannot be negative');
    }

    if (decimalAmount.isZero()) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const category = await this.prisma.category.findFirst({
      where: {
        id: createTransactionDto.categoryId,

        OR: [
          {
            userId: bookExists.userId,
          },
          {
            isDefault: true,
            userId: null,
          },
        ],
      },
    });

    if (!category) {
      throw new BadRequestException('Category not found.');
    }

    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: createTransactionDto.paymentMethodId,

        OR: [
          {
            userId: bookExists.userId,
          },
          {
            isDefault: true,
            userId: null,
          },
        ],
      },
    });

    if (!paymentMethod) {
      throw new BadRequestException('Payment method not found');
    }

    try {
      return await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const newTransaction = await tx.transaction.create({
            data: {
              bookId: createTransactionDto.bookId,
              type: createTransactionDto.type,
              date: new Date(createTransactionDto.date),
              amount: createTransactionDto.amount
                ? decimalAmount
                : new Prisma.Decimal(0),
              remark: createTransactionDto.remark?.trim(),
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

  async findAllByBook(
    bookId: string,
    cursor?: string,
    limit = 10,
    search?: string,
    type?: string,
    sortBy?: string,
    month?: number,
    year?: number,
    categoryId?: string,
    paymentMethodId?: string,
  ) {
    const where: Prisma.TransactionWhereInput = {
      bookId,
    };

    if (type && type !== 'ALL') {
      where.type = type as TransactionType;
    }

    if (search) {
      where.OR = [
        { remark: { contains: search, mode: 'insensitive' } },
        { category: { name: { contains: search, mode: 'insensitive' } } },
        { paymentMethod: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (paymentMethodId) {
      where.paymentMethodId = paymentMethodId;
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 1);
      where.date = {
        gte: startDate,
        lt: endDate,
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year + 1, 0, 1);
      where.date = {
        gte: startDate,
        lt: endDate,
      };
    }

    let orderBy: Prisma.TransactionOrderByWithRelationInput = { date: 'desc' };
    if (sortBy === 'date_asc') orderBy = { date: 'asc' };
    else if (sortBy === 'amount_desc') orderBy = { amount: 'desc' };
    else if (sortBy === 'amount_asc') orderBy = { amount: 'asc' };

    const skip = cursor ? parseInt(cursor, 10) : 0;

    const [transactions, totals] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        orderBy,
        take: limit,
        skip,
        include: {
          category: { select: { id: true, name: true } },
          paymentMethod: { select: { id: true, name: true } },
        },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where,
        orderBy: { type: 'asc' },
        _sum: { amount: true },
      }),
    ]);

    const hasNextPage = transactions.length === limit;
    const nextCursor = hasNextPage ? String(skip + limit) : null;

    const totalIncome =
      totals.find((t) => t.type === 'INCOME')?._sum?.amount ?? 0;
    const totalExpense =
      totals.find((t) => t.type === 'EXPENSE')?._sum?.amount ?? 0;

    return { data: transactions, nextCursor, totalIncome, totalExpense };
  }

  async findOne(id: string) {
    const transaction = await this.prisma.transaction.findUnique({
      where: {
        id,
      },

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
      new Prisma.Decimal(updateTransactionDto.amount).isNegative()
    ) {
      throw new BadRequestException('Amount cannot be negative');
    }

    const updateData: TransactionUpdateData = {
      type: updateTransactionDto.type,
      remark: updateTransactionDto.remark,
      date: updateTransactionDto.date
        ? new Date(updateTransactionDto.date)
        : undefined,
      amount: updateTransactionDto.amount
        ? new Prisma.Decimal(updateTransactionDto.amount)
        : undefined,
    };

    if (updateTransactionDto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: updateTransactionDto.categoryId,

          OR: [
            {
              userId: existingTransaction.book.userId,
            },
            {
              isDefault: true,
              userId: null,
            },
          ],
        },
      });

      if (!category) {
        throw new BadRequestException(
          'Invalid category or category is not available',
        );
      }

      updateData.categoryId = category.id;
    }

    if (updateTransactionDto.paymentMethodId !== undefined) {
      const paymentMethod = await this.prisma.paymentMethod.findFirst({
        where: {
          id: updateTransactionDto.paymentMethodId,

          OR: [
            {
              userId: existingTransaction.book.userId,
            },
            {
              isDefault: true,
              userId: null,
            },
          ],
        },
      });

      if (!paymentMethod) {
        throw new BadRequestException(
          'Invalid payment method or payment method is not available',
        );
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
