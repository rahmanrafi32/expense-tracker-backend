import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseFrequency, ExpenseStatus } from '@prisma/client';

export class UpdateRecurringExpenseDto {
  @ApiPropertyOptional({ example: 'Moon MetLife' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: '6352' })
  @IsOptional()
  @IsDecimal(
    { decimal_digits: '0,2', force_decimal: false },
    {
      message:
        'Amount must be a valid decimal number with up to 2 decimal places',
    },
  )
  amount?: string;

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
