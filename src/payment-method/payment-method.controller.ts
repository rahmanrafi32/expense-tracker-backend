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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { PaymentMethodService } from './payment-method.service';
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { AuthGuard } from '@nestjs/passport';
import { type PaymentMethod } from '@prisma/client';
import { type AuthenticatedRequest } from '../common';

@Controller('payment-methods')
@ApiTags('Payment Methods')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  @ApiOperation({ summary: 'Get payment methods (system + default + user)' })
  @ApiResponse({ status: 200, description: 'List of payment methods' })
  async getPaymentMethodsForUser(
    @Request() req: AuthenticatedRequest,
  ): Promise<PaymentMethod[]> {
    return this.paymentMethodService.getPaymentMethodsForUser(req.user.userId);
  }

  @Get('user-specific')
  @ApiOperation({ summary: 'Get user-specific payment methods' })
  @ApiResponse({
    status: 200,
    description: 'List of user-specific payment methods',
  })
  async getUserSpecificPaymentMethods(
    @Request() req: AuthenticatedRequest,
  ): Promise<PaymentMethod[]> {
    return this.paymentMethodService.getUserSpecificPaymentMethods(
      req.user.userId,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a payment method for user' })
  @ApiResponse({ status: 201, description: 'Payment method created' })
  @ApiResponse({
    status: 409,
    description: 'Payment method with this name already exists',
  })
  async createUserPaymentMethod(
    @Request() req: AuthenticatedRequest,
    @Body() createPaymentMethodDto: CreatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    return this.paymentMethodService.createUserPaymentMethod(
      req.user.userId,
      createPaymentMethodDto,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a user payment method' })
  @ApiResponse({ status: 200, description: 'Payment method updated' })
  @ApiResponse({
    status: 404,
    description: 'Payment method not found or cannot be updated',
  })
  @ApiResponse({
    status: 409,
    description: 'Payment method with this name already exists',
  })
  async updateUserPaymentMethod(
    @Request() req: AuthenticatedRequest,
    @Param('id') paymentMethodId: string,
    @Body() updateData: UpdatePaymentMethodDto,
  ): Promise<PaymentMethod> {
    return this.paymentMethodService.updateUserPaymentMethod(
      req.user.userId,
      paymentMethodId,
      updateData,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a user payment method' })
  @ApiResponse({ status: 204, description: 'Payment method deleted' })
  @ApiResponse({
    status: 404,
    description: 'Payment method not found or cannot be deleted',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete payment method used in transactions',
  })
  async deleteUserPaymentMethod(
    @Request() req: AuthenticatedRequest,
    @Param('id') paymentMethodId: string,
  ): Promise<void> {
    await this.paymentMethodService.deleteUserPaymentMethod(
      req.user.userId,
      paymentMethodId,
    );
  }
}
