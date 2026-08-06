import { IsOptional, IsString, IsEnum, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Currency } from './create-book.dto';
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
  @ApiProperty({ example: 60000, required: false })
  @IsOptional()
  @IsNumber({}, { message: 'Monthly income must be a number' })
  monthlyIncome?: number;

  @ApiPropertyOptional({ enum: BookType, default: 'OPERATING' })
  @IsOptional()
  @IsEnum(BookType)
  type?: BookType;
}
