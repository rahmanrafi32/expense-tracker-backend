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
import * as types from '../common';

@Controller('payment-methods')
@ApiTags('Payment Methods')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  @ApiOperation({ summary: 'Get payment methods (global + user)' })
  @ApiResponse({ status: 200, description: 'List of payment methods' })
  async getPaymentMethodsForUser(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.PaymentMethod[]> {
    return this.paymentMethodService.getPaymentMethodsForUser(req.user.userId);
  }

  @Get('user-specific')
  @ApiOperation({ summary: 'Get user-specific payment methods' })
  @ApiResponse({
    status: 200,
    description: 'List of user-specific payment methods',
  })
  async getUserSpecificPaymentMethods(
    @Request() req: types.AuthenticatedRequest,
  ): Promise<types.PaymentMethod[]> {
    return this.paymentMethodService.getUserSpecificPaymentMethods(
      req.user.userId,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create a payment method for user' })
  @ApiResponse({ status: 201, description: 'Payment method created' })
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
  @ApiOperation({ summary: 'Update a user payment method' })
  @ApiResponse({ status: 200, description: 'Payment method updated' })
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
  @ApiOperation({ summary: 'Delete a user payment method' })
  @ApiResponse({ status: 200, description: 'Payment method deleted' })
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
