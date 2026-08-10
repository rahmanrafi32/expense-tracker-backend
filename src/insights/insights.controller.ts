import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { MonthlyInsightDto, YearlyInsightDto } from './dto/insights.dto';
import { type AuthenticatedRequest } from '../common';

@Controller('insights')
@ApiTags('Insights')
@ApiBearerAuth('jwt')
@UseGuards(AuthGuard('jwt'))
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('monthly-dashboard')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Get monthly financial dashboard insights' })
  async getMonthlyDashboard(
    @Req() req: AuthenticatedRequest,
    @Query() dto: MonthlyInsightDto,
  ) {
    const [
      overview,
      categoryBreakdown,
      fixedVsVariable,
      paymentMethods,
      topTransactions,
    ] = await Promise.all([
      this.insightsService.getMonthlyOverview(req.user.userId, dto),
      this.insightsService.getCategoryBreakdown(req.user.userId, dto),
      this.insightsService.getFixedVsVariable(req.user.userId, dto),
      this.insightsService.getPaymentMethodBreakdown(req.user.userId, dto),
      this.insightsService.getTopTransactions(req.user.userId, dto),
    ]);

    return {
      overview,
      categoryBreakdown,
      fixedVsVariable,
      paymentMethods,
      topTransactions,
    };
  }

  @Get('monthly-overview')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getMonthlyOverview(
    @Req() req: AuthenticatedRequest,
    @Query() dto: MonthlyInsightDto,
  ) {
    return this.insightsService.getMonthlyOverview(req.user.userId, dto);
  }

  @Get('category-breakdown')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getCategoryBreakdown(
    @Req() req: AuthenticatedRequest,
    @Query() dto: MonthlyInsightDto,
  ) {
    return this.insightsService.getCategoryBreakdown(req.user.userId, dto);
  }

  @Get('yearly-trend')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getYearlyTrend(
    @Req() req: AuthenticatedRequest,
    @Query() dto: YearlyInsightDto,
  ) {
    return this.insightsService.getYearlyTrend(req.user.userId, dto);
  }
}
