import { Module } from '@nestjs/common';
import { SpendingTrendsService } from './spending-trends.service';
import { SpendingTrendsController } from './spending-trends.controller';

@Module({
  providers: [SpendingTrendsService],
  controllers: [SpendingTrendsController],
  exports: [SpendingTrendsService],
})
export class SpendingTrendsModule {}
