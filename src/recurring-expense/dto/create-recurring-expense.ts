import { ApiProperty } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory, ExpenseFrequency } from '@prisma/client';

export class CreateRecurringExpenseDto {
  @ApiProperty({ example: 'uuid-of-book' })
  @IsUUID()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({ example: 'Moon Metlife' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 6352 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    enum: ExpenseFrequency,
    example: ExpenseFrequency.QUARTERLY,
  })
  @IsEnum(ExpenseFrequency)
  frequency: ExpenseFrequency;

  @ApiProperty({
    enum: ExpenseCategory,
    example: ExpenseCategory.INSURANCE,
    description: 'Category of the recurring expense',
  })
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({
    example: '2026-07-30T00:00:00.000Z',
    description: 'Next due date (ISO string)',
  })
  @IsDate()
  @Type(() => Date)
  nextDueDate: Date;
}
