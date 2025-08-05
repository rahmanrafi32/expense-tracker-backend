import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionService {
  constructor(private prisma: PrismaService) {}

  async create(createTransactionDto: CreateTransactionDto) {
    const bookExists = await this.prisma.book.findUnique({
      where: { id: createTransactionDto.bookId },
      include: { user: true },
    });

    if (!bookExists) {
      throw new NotFoundException(`Book not found`);
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
      return await this.prisma.transaction.create({
        data: {
          bookId: createTransactionDto.bookId,
          type: createTransactionDto.type,
          date: new Date(createTransactionDto.date),
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
    } catch (error) {
      if (error.code === 'P2003') {
        throw new BadRequestException('Invalid book ID provided');
      }
      throw error;
    }
  }

  async findAllByBook(bookId: string) {
    return this.prisma.transaction.findMany({
      where: { bookId },
      orderBy: { date: 'desc' },
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
  }

  async findOne(id: string) {
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

    const updateData: any = {
      type: updateTransactionDto.type,
      remark: updateTransactionDto.remark,
      date: updateTransactionDto.date
        ? new Date(updateTransactionDto.date)
        : undefined,
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

    return this.prisma.transaction.update({
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
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.transaction.delete({
      where: { id },
    });
  }
}
