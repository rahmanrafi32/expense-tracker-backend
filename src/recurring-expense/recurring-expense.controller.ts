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
import { type Request } from 'express';

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
  create(@Req() req: Request, @Body() dto: CreateRecurringExpenseDto) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.create(userId, dto);
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
  findAll(@Req() req: Request, @Query('bookId') bookId: string) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.findAllByBook(userId, bookId);
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
  getSummary(@Req() req: Request, @Query('bookId') bookId: string) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.getSummary(userId, bookId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a recurring expense by id',
  })
  findOne(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.findOne(userId, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a recurring expense',
  })
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.update(userId, id, dto);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({
    summary: 'Mark recurring expense as paid and advance next due date',
  })
  markPaid(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.markPaid(userId, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a recurring expense',
  })
  remove(@Req() req: Request, @Param('id') id: string) {
    const userId = (req.user as { id: string }).id;

    return this.recurringExpenseService.remove(userId, id);
  }
}
