import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseFrequency } from '@prisma/client';

export class CreateRecurringExpenseDto {
  @ApiProperty({ example: 'uuid-of-book' })
  @IsUUID()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({ example: 'Moon Metlife' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '6352' })
  @IsDecimal(
    { decimal_digits: '0,2', force_decimal: false },
    {
      message:
        'Amount must be a valid decimal number with up to 2 decimal places',
    },
  )
  amount: string;

  @ApiProperty({
    enum: ExpenseFrequency,
    example: ExpenseFrequency.QUARTERLY,
  })
  @IsEnum(ExpenseFrequency)
  frequency: ExpenseFrequency;

  @ApiProperty({
    example: '99348009-2d8d-4617-b56a-2871ec12b13d',
    description: 'Category UUID',
  })
  @IsNotEmpty({
    message: 'Category ID is required',
  })
  @IsUUID('all', {
    message: 'Category ID must be a valid UUID',
  })
  categoryId: string;

  @ApiProperty({
    example: '11111111-2222-4333-8444-555555555555',
    description: 'Payment method UUID',
  })
  @IsNotEmpty({
    message: 'Payment method ID is required',
  })
  @IsUUID('all', {
    message: 'Payment method ID must be a valid UUID',
  })
  paymentMethodId: string;

  @ApiProperty({
    example: '2026-07-30T00:00:00.000Z',
    description: 'Next due date (ISO string)',
  })
  @IsDate()
  @Type(() => Date)
  nextDueDate: Date;
}
