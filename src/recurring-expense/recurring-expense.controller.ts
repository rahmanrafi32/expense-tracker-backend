import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { type AuthenticatedRequest } from '../common';

import { RecurringExpenseService } from './recurring-expense.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense';

@Controller('recurring-expense')
@ApiTags('Recurring Expense')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class RecurringExpenseController {
  constructor(
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring expense' })
  @ApiResponse({
    status: 201,
    description: 'Recurring expense created',
  })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.recurringExpenseService.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all recurring expenses for a book',
  })
  @ApiResponse({
    status: 200,
    description:
      'List of recurring expenses with monthly equivalent and days until due',
  })
  findAll(@Req() req: AuthenticatedRequest, @Query('bookId') bookId: string) {
    return this.recurringExpenseService.findAllByBook(req.user.userId, bookId);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get recurring expense summary stats for header cards',
  })
  @ApiResponse({
    status: 200,
    description:
      'Monthly total, due this month, next payment, and shortfall information',
  })
  getSummary(
    @Req() req: AuthenticatedRequest,
    @Query('bookId') bookId: string,
  ) {
    return this.recurringExpenseService.getSummary(req.user.userId, bookId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a recurring expense by id',
  })
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.recurringExpenseService.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a recurring expense',
  })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    return this.recurringExpenseService.update(req.user.userId, id, dto);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({
    summary: 'Mark recurring expense as paid and advance next due date',
  })
  markPaid(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.recurringExpenseService.markPaid(req.user.userId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a recurring expense',
  })
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.recurringExpenseService.remove(req.user.userId, id);
  }
}
