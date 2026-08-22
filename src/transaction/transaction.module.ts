import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';
import { AllocationModule } from '../allocation/allocation.module';

@Module({
  imports: [AllocationModule],
  controllers: [TransactionController],
  providers: [TransactionService, PrismaService, BalanceService],
})
export class TransactionModule {}
