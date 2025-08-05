import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PaymentMethodService } from './payment-method.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { AuthGuard } from '@nestjs/passport';
import * as types from '../common';

@Controller('payment-methods')
@UseGuards(AuthGuard('jwt'))
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  async getPaymentMethodsForUser(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.PaymentMethod[]> {
    return this.paymentMethodService.getPaymentMethodsForUser(req.user.userId);
  }

  @Get('user-specific')
  async getUserSpecificPaymentMethods(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.PaymentMethod[]> {
    return this.paymentMethodService.getUserSpecificPaymentMethods(
      req.user.userId,
    );
  }

  @Post()
  async createUserPaymentMethod(
    @Request() req: types.AuthenticatedRequest,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<types.PaymentMethod> {
    return this.paymentMethodService.createUserPaymentMethod(
      req.user.userId,
      createPaymentMethodDto,
    );
  }

  @Put(':id')
  async updateUserPaymentMethod(
    @Request() req: types.AuthenticatedRequest,
    @Param('id') paymentMethodId: string,
    @Body() updateData: UpdatePaymentMethodDto,
  ): Promise<types.PaymentMethod> {
    return this.paymentMethodService.updateUserPaymentMethod(
      req.user.userId,
      paymentMethodId,
      updateData,
    );
  }

  @Delete(':id')
  async deleteUserPaymentMethod(
    @Request() req: types.AuthenticatedRequest,
    @Param('id') paymentMethodId: string,
  ): Promise<types.PaymentMethod> {
    return this.paymentMethodService.deleteUserPaymentMethod(
      req.user.userId,
      paymentMethodId,
    );
  }
}
