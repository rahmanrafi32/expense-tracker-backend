import {
  Controller,
  Get,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InsightsService } from './insights.service';
import { MonthlyInsightDto, YearlyInsightDto } from './dto/insights.dto';

@Controller('insights')
export class InsightsController {
  constructor(private readonly insightsService: InsightsService) {}

  @Get('monthly-dashboard')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getMonthlyDashboard(@Query() dto: MonthlyInsightDto) {
    const [
      overview,
      categoryBreakdown,
      fixedVsVariable,
      paymentMethods,
      topTransactions,
    ] = await Promise.all([
      this.insightsService.getMonthlyOverview(dto),
      this.insightsService.getCategoryBreakdown(dto),
      this.insightsService.getFixedVsVariable(dto),
      this.insightsService.getPaymentMethodBreakdown(dto),
      this.insightsService.getTopTransactions(dto),
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
  async getMonthlyOverview(@Query() dto: MonthlyInsightDto) {
    return this.insightsService.getMonthlyOverview(dto);
  }

  @Get('category-breakdown')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getCategoryBreakdown(@Query() dto: MonthlyInsightDto) {
    return this.insightsService.getCategoryBreakdown(dto);
  }

  @Get('yearly-trend')
  @UsePipes(new ValidationPipe({ transform: true }))
  async getYearlyTrend(@Query() dto: YearlyInsightDto) {
    return this.insightsService.getYearlyTrend(dto);
  }
}
