import { Module } from '@nestjs/common';
import { RecurringExpenseService } from './recurring-expense.service';
import { RecurringExpenseController } from './recurring-expense.controller';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AllocationModule } from '../allocation/allocation.module';

@Module({
  imports: [AllocationModule],
  controllers: [RecurringExpenseController],
  providers: [RecurringExpenseService, PrismaService, BalanceService],
  exports: [RecurringExpenseService],
})
export class RecurringExpenseModule {}
