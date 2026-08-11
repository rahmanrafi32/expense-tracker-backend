import { IsOptional, IsString, IsEnum, IsDecimal } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from '../enums/currency.enum';
import { BookType } from '@prisma/client';

export class UpdateBookDto {
  @ApiProperty({ example: 'Updated book name', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 'USD',
    description: 'Currency code (ISO 4217)',
    enum: Currency,
    required: false,
  })
  @IsOptional()
  @IsEnum(Currency, {
    message: 'Currency must be a valid ISO 4217 currency code',
  })
  currency?: Currency;
  @ApiProperty({ example: '60000', required: false })
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
