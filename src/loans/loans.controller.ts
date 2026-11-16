import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type AuthenticatedRequest } from '../common';
import {
  CreateLoanDto,
  LoanBookQueryDto,
  LoanPaymentDto,
  LoanQueryDto,
  UpdateLoanDto,
} from './dto/loan.dto';
import { LoansService } from './loans.service';

@ApiTags('Loans')
@ApiCookieAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Post()
  @ApiOperation({ summary: 'Create a loan and post its cash movement' })
  create(@Request() req: AuthenticatedRequest, @Body() dto: CreateLoanDto) {
    return this.loans.create(req.user.userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List loans for a book' })
  list(@Request() req: AuthenticatedRequest, @Query() dto: LoanQueryDto) {
    return this.loans.findAll(req.user.userId, dto);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get outstanding and overdue loan totals' })
  summary(
    @Request() req: AuthenticatedRequest,
    @Query() dto: LoanBookQueryDto,
  ) {
    return this.loans.summary(req.user.userId, dto.bookId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a loan with repayment history' })
  findOne(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.loans.findOne(req.user.userId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit loan contact, notes, or payoff date' })
  update(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLoanDto,
  ) {
    return this.loans.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a mistaken loan without repayments' })
  remove(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.loans.remove(req.user.userId, id);
  }

  @Post(':id/repayments')
  @ApiOperation({ summary: 'Record a loan repayment' })
  repay(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LoanPaymentDto,
  ) {
    return this.loans.repay(req.user.userId, id, dto);
  }

  @Delete(':id/repayments/:repaymentId')
  @ApiOperation({ summary: 'Reverse a mistaken repayment' })
  reverse(
    @Request() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('repaymentId', ParseUUIDPipe) repaymentId: string,
  ) {
    return this.loans.removeRepayment(req.user.userId, id, repaymentId);
  }
}
