import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionController } from './transaction.controller';
import { PrismaService } from '../database/prisma.service';
import { BalanceService } from '../balance/balance.service';

@Module({
  controllers: [TransactionController],
  providers: [TransactionService, PrismaService, BalanceService],
})
export class TransactionModule {}
