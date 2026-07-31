import { Module } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { GoalsController } from './goals.controller';
import { PrismaService } from '../database/prisma.service';

@Module({
  controllers: [GoalsController],
  providers: [GoalsService, PrismaService],
  exports: [GoalsService],
})
export class GoalsModule {}
