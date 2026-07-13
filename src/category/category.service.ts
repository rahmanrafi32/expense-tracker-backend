import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getCategoriesForUser(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createUserCategory(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ) {
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        name: createCategoryDto.name,
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
      },
    });

    if (existingCategory) {
      throw new Error('Category already exists');
    }

    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        isDefault: false,
        userId: userId,
      },
    });
  }

  async getUserSpecificCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        userId: userId,
        isDefault: false,
      },
      orderBy: { name: 'asc' },
    });
  }

  async deleteUserCategory(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        isDefault: false,
      },
    });

    if (!category) {
      throw new Error('Category not found or cannot be deleted');
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: categoryId },
    });

    if (transactionCount > 0) {
      throw new Error(
        'Cannot delete category that is being used in transactions',
      );
    }

    return this.prisma.category.delete({
      where: { id: categoryId },
    });
  }

  async updateUserCategory(
    userId: string,
    categoryId: string,
    updateData: { name: string },
  ) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: userId,
        isDefault: false,
      },
    });

    if (!category) {
      throw new Error('Category not found or cannot be updated');
    }

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        name: updateData.name,
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
        NOT: { id: categoryId },
      },
    });

    if (existingCategory) {
      throw new Error('Category with this name already exists');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { name: updateData.name },
    });
  }
}
