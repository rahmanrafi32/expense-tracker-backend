import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { CashFlowService } from './cash-flow.service';
import { GetCashFlowDto } from './dto/cash-flow-query.dto';

@Controller('cash-flow')
@ApiTags('Cash Flow')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class CashFlowController {
  constructor(private readonly cashFlowService: CashFlowService) {}

  @Get()
  @ApiOperation({ summary: 'Get projected cash flow timeline for a book' })
  getTimeline(@Query() dto: GetCashFlowDto) {
    return this.cashFlowService.getTimeline(dto);
  }
}
