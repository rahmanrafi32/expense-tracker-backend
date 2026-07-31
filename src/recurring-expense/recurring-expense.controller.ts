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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RecurringExpenseService } from './recurring-expense.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense';

@Controller('recurring-expense')
@ApiTags('Recurring Expense')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class RecurringExpenseController {
  constructor(private readonly commitmentService: RecurringExpenseService) {}

  @Post()
  @ApiOperation({ summary: 'Create a recurring expense' })
  @ApiResponse({ status: 201, description: 'Recurring expense created' })
  create(@Body() dto: CreateRecurringExpenseDto) {
    return this.commitmentService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all recurring-expense for a book' })
  @ApiResponse({
    status: 200,
    description:
      'List of recurring-expense with monthly equivalent and days until due',
  })
  findAll(@Query('bookId') bookId: string) {
    return this.commitmentService.findAllByBook(bookId);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get recurring-expense summary stats for header cards',
  })
  @ApiResponse({
    status: 200,
    description: 'Monthly total, due this month, next payment',
  })
  getSummary(@Query('bookId') bookId: string) {
    return this.commitmentService.getSummary(bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a recurring-expense by id' })
  findOne(@Param('id') id: string) {
    return this.commitmentService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a recurring-expense' })
  update(@Param('id') id: string, @Body() dto: UpdateRecurringExpenseDto) {
    return this.commitmentService.update(id, dto);
  }

  @Patch(':id/mark-paid')
  @ApiOperation({
    summary: 'Mark recurring-expense as paid and advance next due date',
  })
  markPaid(@Param('id') id: string) {
    return this.commitmentService.markPaid(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a recurring-expense' })
  remove(@Param('id') id: string) {
    return this.commitmentService.remove(id);
  }
}
