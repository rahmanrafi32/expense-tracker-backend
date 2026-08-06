import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseFrequency, ExpenseStatus } from '@prisma/client';

export class UpdateRecurringExpenseDto {
  @ApiPropertyOptional({ example: 'Moon MetLife' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 6352 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiPropertyOptional({ enum: ExpenseFrequency })
  @IsOptional()
  @IsEnum(ExpenseFrequency)
  frequency?: ExpenseFrequency;

  @ApiPropertyOptional({
    example: '2026-07-30T00:00:00.000Z',
    description: 'Next due date (ISO string)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextDueDate?: Date;

  @ApiPropertyOptional({
    enum: ExpenseStatus,
    description: 'Mark as PAID / UNPAID (OVERDUE is usually computed)',
  })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;
}
