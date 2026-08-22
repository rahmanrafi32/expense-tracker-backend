import { Module } from '@nestjs/common';
import { SinkingFundController } from './sinking-funds.controller';
import { SinkingFundService } from './sinking-funds.service';
import { AllocationModule } from '../allocation/allocation.module';

@Module({
  controllers: [SinkingFundController],
  imports: [AllocationModule],
  providers: [SinkingFundService],
})
export class SinkingFundsModule {}
