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
import { type TransactionUpdateData } from './types/transaction-update-data.type';
import { AllocationService } from '../allocation/allocation.service';
import dayjs from 'dayjs';

@Injectable()
export class TransactionService {
  constructor(
    private prisma: PrismaService,
    private balanceService: BalanceService,
    private allocationService: AllocationService,
  ) {}

  async create(userId: string, createTransactionDto: CreateTransactionDto) {
    const bookExists = await this.prisma.book.findFirst({
      where: { id: createTransactionDto.bookId, userId },
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
            userId,
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
            userId,
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
              date: dayjs(createTransactionDto.date).toDate(),
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

          if (createTransactionDto.type === TransactionType.INCOME) {
            await this.allocationService.allocate(
              tx,
              createTransactionDto.bookId,
              decimalAmount,
              dayjs(createTransactionDto.date).toDate(),
              `Automatic allocation for income transaction`,
              newTransaction.id,
            );
          } else if (createTransactionDto.type === TransactionType.EXPENSE) {
            await this.allocationService.consumeUnallocated(
              tx,
              createTransactionDto.bookId,
              decimalAmount,
            );
          }

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
    userId: string,
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
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      select: { id: true },
    });

    if (!book) {
      throw new NotFoundException(`Book ${bookId} not found`);
    }

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
      const startDate = dayjs()
        .year(year)
        .month(month - 1)
        .date(1)
        .startOf('day')
        .toDate();
      const endDate = dayjs()
        .year(year)
        .month(month)
        .date(1)
        .startOf('day')
        .toDate();
      where.date = {
        gte: startDate,
        lt: endDate,
      };
    } else if (year) {
      const startDate = dayjs().year(year).startOf('year').toDate();
      const endDate = dayjs()
        .year(year + 1)
        .startOf('year')
        .toDate();
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

  async findOne(userId: string, id: string) {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, book: { userId } },

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

  async update(
    userId: string,
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const existingTransaction = await this.prisma.transaction.findFirst({
      where: { id, book: { userId } },
      include: { book: { select: { userId: true } } },
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
        ? dayjs(updateTransactionDto.date).toDate()
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
              userId,
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
              userId,
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

  async remove(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.findOne(userId, id);
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deletedTransaction = await tx.transaction.delete({
        where: { id },
      });
      await this.balanceService.updateBookBalance(tx, transaction.bookId);
      return deletedTransaction;
    });
  }
}
