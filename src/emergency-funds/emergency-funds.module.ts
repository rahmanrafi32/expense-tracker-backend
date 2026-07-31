import { Module } from '@nestjs/common';
import { EmergencyService } from './emergency-funds.service';
import { EmergencyController } from './emergency-funds.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [EmergencyController],
  providers: [EmergencyService, PrismaService],
  exports: [EmergencyService],
})
export class EmergencyFundsModule {}
