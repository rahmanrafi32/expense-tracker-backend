import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
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

  @ApiProperty({
    example: '99348009-2d8d-4617-b56a-2871ec12b13d',
    description: 'Category UUID',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Category ID must be a valid UUID',
  })
  categoryId?: string;

  @ApiProperty({
    example: '11111111-2222-4333-8444-555555555555',
    description: 'Payment method UUID',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Payment method ID must be a valid UUID',
  })
  paymentMethodId?: string;

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
