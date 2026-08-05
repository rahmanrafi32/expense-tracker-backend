import { Module } from '@nestjs/common';
import { CashFlowService } from './cash-flow.service';
import { CashFlowController } from './cash-flow.controller';

@Module({
  controllers: [CashFlowController],
  providers: [CashFlowService],
})
export class CashFlowModule {}
