import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAllocationDto {
  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000000',
    description: 'Book UUID',
  })
  @IsNotEmpty()
  @IsUUID()
  bookId: string;

  @ApiProperty({
    example: '18200',
    description: 'Amount available for allocation',
  })
  @IsNotEmpty()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  amount: string;

  @ApiPropertyOptional({
    example: '2026-08-22',
    description: 'Allocation date',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    example: 'August reserve contribution',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
