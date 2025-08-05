import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';

@Injectable()
export class PaymentMethodService {
  constructor(private prisma: PrismaService) {}

  async getPaymentMethodsForUser(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: {
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async createUserPaymentMethod(
    userId: string,
    createPaymentMethodDto: CreatePaymentMethodDto,
  ) {
    const existingPaymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: createPaymentMethodDto.name,
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
      },
    });

    if (existingPaymentMethod) {
      throw new Error('Payment method with this name already exists');
    }

    return this.prisma.paymentMethod.create({
      data: {
        name: createPaymentMethodDto.name,
        isDefault: false,
        userId: userId,
      },
    });
  }

  async getUserSpecificPaymentMethods(userId: string) {
    return this.prisma.paymentMethod.findMany({
      where: {
        userId: userId,
        isDefault: false,
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
      },
    });

    if (!paymentMethod) {
      throw new Error('Payment method not found or cannot be deleted');
    }

    const transactionCount = await this.prisma.transaction.count({
      where: { paymentMethodId: paymentMethodId },
    });

    if (transactionCount > 0) {
      throw new Error(
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
      },
    });

    if (!paymentMethod) {
      throw new Error('Payment method not found or cannot be updated');
    }

    const existingPaymentMethod = await this.prisma.paymentMethod.findFirst({
      where: {
        name: updateData.name,
        OR: [{ isDefault: true, userId: null }, { userId: userId }],
        NOT: { id: paymentMethodId },
      },
    });

    if (existingPaymentMethod) {
      throw new Error('Payment method with this name already exists');
    }

    return this.prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { name: updateData.name },
    });
  }
}
