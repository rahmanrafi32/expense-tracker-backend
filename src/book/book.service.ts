import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
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
        bookTotalAmount: createBookDto.bookTotalAmount,
        currency: createBookDto.currency,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.book.findMany({
      where: { userId },
      include: { transactions: true },
    });
  }

  async findOne(id: string) {
    const book = await this.prisma.book.findUnique({
      where: { id },
      include: { transactions: true },
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
    return this.prisma.book.update({
      where: { id },
      data: updateBookDto,
    });
  }

  async remove(id: string, currentUserId: string) {
    const book = await this.findOne(id);
    if (book.userId !== currentUserId) {
      throw new UnauthorizedException(
        'You are not authorized to delete this book',
      );
    }
    return this.prisma.book.delete({
      where: { id },
    });
  }
}
