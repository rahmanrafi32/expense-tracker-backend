import {
  IsDateString,
  IsNotEmpty,
  IsDecimal,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSinkingFundDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000000' })
  @IsNotEmpty()
  @IsUUID()
  bookId: string;

  @ApiProperty({ example: 'Car Servicing' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 15000 })
  @IsNotEmpty()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  targetAmount: string;

  @ApiProperty({ example: '2026-11-30' })
  @IsNotEmpty()
  @IsDateString()
  deadline: string;

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
}
