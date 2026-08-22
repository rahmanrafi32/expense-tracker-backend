import {
  IsDateString,
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
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

  @ApiProperty({
    example: '99348009-2d8d-4617-b56a-2871ec12b13d',
    description: 'Category UUID',
    required: false,
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Category ID must be a valid UUID',
  })
  categoryId?: string;
}
