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

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  paymentMethod: string;

  @ApiProperty({
    example: '2026-07-30T00:00:00.000Z',
    description: 'Next due date (ISO string)',
  })
  @IsDate()
  @Type(() => Date)
  nextDueDate: Date;
}
