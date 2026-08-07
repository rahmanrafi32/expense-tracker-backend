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
import { TransactionService } from './transaction.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('transactions')
@ApiTags('Transactions')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  @Post('add')
  @ApiOperation({ summary: 'Add a transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created' })
  create(@Body() createTransactionDto: CreateTransactionDto) {
    return this.transactionService.create(createTransactionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get transactions by book with filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of transactions' })
  findAll(
    @Query('bookId') bookId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('sortBy') sortBy?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('categoryId') categoryId?: string,
    @Query('paymentMethodId') paymentMethodId?: string,
  ) {
    return this.transactionService.findAllByBook(
      bookId,
      cursor,
      limit ? parseInt(limit, 10) : 20,
      search,
      type,
      sortBy,
      month ? parseInt(month, 10) : undefined,
      year ? parseInt(year, 10) : undefined,
      categoryId,
      paymentMethodId,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by id' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  findOne(@Param('id') id: string) {
    return this.transactionService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiResponse({ status: 200, description: 'Updated transaction' })
  update(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.transactionService.update(id, updateTransactionDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiResponse({ status: 200, description: 'Deleted transaction' })
  remove(@Param('id') id: string) {
    return this.transactionService.remove(id);
  }
}
