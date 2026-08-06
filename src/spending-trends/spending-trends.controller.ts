import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SpendingTrendsService } from './spending-trends.service';
import { GetSpendingTrendDto } from './dto/spending-trend.dto';

@Controller('spending-trends')
@ApiTags('Spending Trends')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class SpendingTrendsController {
  constructor(private readonly spendingTrendsService: SpendingTrendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get spending trend analysis' })
  findAll(@Query() dto: GetSpendingTrendDto) {
    return this.spendingTrendsService.getSpendingTrend(dto.bookId, dto.months);
  }
}
