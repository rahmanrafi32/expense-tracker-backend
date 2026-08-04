import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@Injectable()
export class PaymentMethodService {
  constructor(private prisma: PrismaService) {}

  async getPaymentMethodsForUser(userId: string) {
    return this.prisma.paymentMethod.findMany({
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

  async createUserPaymentMethod(
    userId: string,
    createPaymentMethodDto: CreatePaymentMethodDto,
  ) {
    const existingPaymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: createPaymentMethodDto.name,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
      },
    });

    if (existingPaymentMethod) {
      throw new ConflictException(
        'Payment method with this name already exists',
      );
    }

    return this.prisma.paymentMethod.create({
      data: {
        name: createPaymentMethodDto.name,
        isDefault: false,
        isSystem: false,
        userId: userId,
      },
    });
  }

  async getUserSpecificPaymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: {
        userId: userId,
        isDefault: false,
        isSystem: false,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDefaultPaymentMethods() {
    return this.prisma.paymentMethod.findMany({
      where: {
        isDefault: true,
        isSystem: false,
        userId: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getSystemPaymentMethods() {
    return this.prisma.paymentMethod.findMany({
      where: {
        isSystem: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async deleteUserPaymentMethod(userId: string, paymentMethodId: string) {
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: userId,
        isDefault: false,
        isSystem: false,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException(
        'Payment method not found or cannot be deleted',
      );
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { paymentMethodId: paymentMethodId },
    });

    if (transactionCount > 0) {
      throw new BadRequestException(
        'Cannot delete payment method that is being used in transactions',
      );
    }

    return this.prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });
  }

  async updateUserPaymentMethod(
    userId: string,
    paymentMethodId: string,
    updateData: { name: string },
  ) {
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        userId: userId,
        isDefault: false,
        isSystem: false,
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException(
        'Payment method not found or cannot be updated',
      );
    }

    const existingPaymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: updateData.name,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
        NOT: { id: paymentMethodId },
      },
    });

    if (existingPaymentMethod) {
      throw new ConflictException(
        'Payment method with this name already exists',
      );
    }

    return this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { name: updateData.name },
    });
  }

  async getPaymentMethodById(userId: string, paymentMethodId: string) {
    const paymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        OR: [
          { isSystem: true },
          { isDefault: true, userId: null },
          { userId: userId },
        ],
      },
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    return paymentMethod;
  }
}
