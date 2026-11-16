import { Module } from '@nestjs/common';
import { AllocationModule } from '../allocation/allocation.module';
import { BalanceService } from '../balance/balance.service';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';

@Module({
  imports: [AllocationModule],
  controllers: [LoansController],
  providers: [LoansService, BalanceService],
})
export class LoansModule {}
