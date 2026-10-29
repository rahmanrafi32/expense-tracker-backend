import { Module } from '@nestjs/common';
import { SinkingFundController } from './sinking-funds.controller';
import { SinkingFundService } from './sinking-funds.service';

@Module({
  controllers: [SinkingFundController],
  providers: [SinkingFundService],
})
export class SinkingFundsModule {}
