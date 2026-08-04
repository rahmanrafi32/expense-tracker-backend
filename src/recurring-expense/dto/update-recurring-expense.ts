import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseStatus,
} from '@prisma/client';

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

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

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
