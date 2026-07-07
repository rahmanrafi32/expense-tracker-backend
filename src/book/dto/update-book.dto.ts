import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Currency } from './create-book.dto';

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

  @ApiProperty({ example: 0, required: false })
  bookTotalAmount: number;
}
