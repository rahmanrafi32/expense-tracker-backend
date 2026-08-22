import { Module } from '@nestjs/common';
import { AllocationService } from './allocation.service';
import { AllocationController } from './allocation.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [AllocationController],
  providers: [AllocationService, PrismaService],
  exports: [AllocationService],
})
export class AllocationModule {}
