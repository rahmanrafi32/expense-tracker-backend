import { IsDateString, IsDecimal, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateSinkingFundDto {
  @ApiProperty({ example: 'Car Servicing', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: 20000, required: false })
  @IsOptional()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  targetAmount?: string;

  @ApiProperty({ example: '2026-12-31', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ example: 'car', required: false })
  @IsOptional()
  @IsString()
  icon?: string;
}
