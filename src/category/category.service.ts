import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  async getCategoriesForUser(userId: string) {
    return this.prisma.category.findMany({
      where: {
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
      },
      orderBy: [{ isSystem: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createUserCategory(
    userId: string,
    createCategoryDto: CreateCategoryDto,
  ) {
    const existingCategory = await this.prisma.category.findFirst({
      where: {
        name: createCategoryDto.name,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.category.create({
      data: {
        name: createCategoryDto.name,
        isDefault: false,
        isSystem: false,
        userId: userId,
      },
    });
  }

  async getUserSpecificCategories(userId: string) {
    return this.prisma.category.findMany({
      where: {
        userId: userId,
        isDefault: false,
        isSystem: false,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDefaultCategories() {
    return this.prisma.category.findMany({
      where: {
        isDefault: true,
        isSystem: false,
        userId: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSystemCategories() {
    return this.prisma.category.findMany({
      where: {
        isSystem: true,
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
        isSystem: false,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found or cannot be deleted');
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { categoryId: categoryId },
    });

    const sinkingFundCount = await this.prisma.sinkingFund.count({
      where: { categoryId: categoryId },
    });

    if (transactionCount > 0 || sinkingFundCount > 0) {
      throw new BadRequestException(
        'Cannot delete category that is being used in transactions or sinking funds',
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
        isSystem: false,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found or cannot be updated');
    }

    const existingCategory = await this.prisma.category.findFirst({
      where: {
        name: updateData.name,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
        NOT: { id: categoryId },
      },
    });

    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    return this.prisma.category.update({
      where: { id: categoryId },
      data: { name: updateData.name },
    });
  }

  async getCategoryById(userId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async getExpenseCategories() {
    return this.prisma.category.findMany({
      where: {
        isIncome: false,
        OR: [{ isSystem: true }, { isDefault: true, userId: null }],
      },
      orderBy: [{ isSystem: 'desc' }, { isDefault: 'desc' }, { name: 'asc' }],
    });
  }
}
