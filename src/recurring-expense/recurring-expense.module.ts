import { Module } from '@nestjs/common';
import { RecurringExpenseService } from './recurring-expense.service';
import { RecurringExpenseController } from './recurring-expense.controller';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';

@Module({
  controllers: [RecurringExpenseController],
  providers: [RecurringExpenseService, PrismaService, BalanceService],
  exports: [RecurringExpenseService],
})
export class RecurringExpenseModule {}
