import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';

@Injectable()
export class BookService {
  constructor(private prisma: PrismaService) {}

  async create(createBookDto: CreateBookDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: createBookDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User not found`);
    }

    return this.prisma.book.create({
      data: {
        name: createBookDto.name,
        userId: createBookDto.userId,
        currency: createBookDto.currency,
        monthlyIncome: createBookDto.monthlyIncome
          ? new Prisma.Decimal(createBookDto.monthlyIncome)
          : new Prisma.Decimal(0),
        type: createBookDto.type,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.book.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
    });
    if (!book) {
      throw new NotFoundException(`Book with id ${id} not found`);
    }
    return book;
  }

  async update(
    id: string,
    updateBookDto: UpdateBookDto,
    currentUserId: string,
  ) {
    const book = await this.findOne(id);
    if (book.userId !== currentUserId) {
      throw new UnauthorizedException(
        'You are not authorized to update this book',
      );
    }
    const updateData: Prisma.BookUpdateInput = {};
    if (updateBookDto.name !== undefined) updateData.name = updateBookDto.name;
    if (updateBookDto.currency !== undefined)
      updateData.currency = updateBookDto.currency;
    if (updateBookDto.monthlyIncome !== undefined)
      updateData.monthlyIncome = new Prisma.Decimal(
        updateBookDto.monthlyIncome,
      );
    if (updateBookDto.type !== undefined) updateData.type = updateBookDto.type;

    return this.prisma.book.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, currentUserId: string) {
    const book = await this.findOne(id);

    if (book.userId !== currentUserId) {
      throw new UnauthorizedException(
        'You are not authorized to delete this book',
      );
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const deletedBook = await tx.book.delete({
        where: {
          id,
        },
      });

      await tx.transfer.deleteMany({
        where: {
          userId: currentUserId,
          sourceBookId: null,
          targetBookId: null,
        },
      });

      return deletedBook;
    });
  }
}
