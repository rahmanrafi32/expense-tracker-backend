import {
  IsDateString,
  IsNotEmpty,
  IsDecimal,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSinkingFundDepositDto {
  @ApiProperty({ example: 5000 })
  @IsNotEmpty()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  amount: string;

  @ApiProperty({ example: 'Saved from this months surplus', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: '2026-08-01', required: false })
  @IsOptional()
  @IsDateString()
  date?: string;
}
