import { Module } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';
import { SpendingTrendsModule } from '../spending-trends/spending-trends.module';

@Module({
  imports: [SpendingTrendsModule],
  providers: [CashFlowService],
  controllers: [CashFlowController],
  exports: [CashFlowService],
})
export class CashFlowModule {}
