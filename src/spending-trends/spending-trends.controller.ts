import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SpendingTrendsService } from './spending-trends.service';
import { GetSpendingTrendDto } from './dto/spending-trend.dto';
import { type AuthenticatedRequest } from '../common';

@Controller('spending-trends')
@ApiTags('Spending Trends')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class SpendingTrendsController {
  constructor(private readonly spendingTrendsService: SpendingTrendsService) {}

  @Get()
  @ApiOperation({ summary: 'Get spending trend analysis' })
  findAll(@Req() req: AuthenticatedRequest, @Query() dto: GetSpendingTrendDto) {
    return this.spendingTrendsService.getSpendingTrend(
      req.user.userId,
      dto.bookId,
      dto.months,
    );
  }
}
