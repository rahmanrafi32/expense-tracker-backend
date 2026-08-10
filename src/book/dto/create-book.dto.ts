import {
  IsNotEmpty,
  IsString,
  IsUUID,
  MinLength,
  IsOptional,
  IsEnum,
  IsDecimal,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookType } from '@prisma/client';

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
  GBP = 'GBP',
  BDT = 'BDT',
  INR = 'INR',
}

export class CreateBookDto {
  @ApiProperty({ example: 'Monthly Budget', description: 'Name of the book' })
  @IsNotEmpty({ message: 'Book name is required' })
  @IsString({ message: 'Book name must be a string' })
  @MinLength(3, { message: 'Book name must be at least 3 characters long' })
  name: string;

  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000000',
    description: 'User UUID',
  })
  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId: string;

  @ApiProperty({
    example: 'BDT',
    description: 'Currency code (ISO 4217)',
    enum: Currency,
    default: Currency.BDT,
    required: false,
  })
  @IsOptional()
  @IsEnum(Currency, {
    message: 'Currency must be a valid ISO 4217 currency code',
  })
  currency?: Currency = Currency.BDT;

  @ApiProperty({
    example: '51700',
    description: 'Expected monthly income/deposit for this book',
    required: false,
  })
  @IsOptional()
  @IsDecimal(
    { decimal_digits: '0,2', force_decimal: false },
    {
      message:
        'Monthly income must be a valid decimal number with up to 2 decimal places',
    },
  )
  monthlyIncome?: string;

  @ApiPropertyOptional({ enum: BookType, default: 'OPERATING' })
  @IsOptional()
  @IsEnum(BookType)
  type?: BookType;
}
