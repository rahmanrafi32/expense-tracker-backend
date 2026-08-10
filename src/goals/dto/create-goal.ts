import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDecimal,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ example: 'uuid-of-book' })
  @IsUUID()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({ example: 'Buy iPhone' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: '38500.00',
    description: 'Goal target amount',
  })
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  targetAmount: string;

  @ApiProperty({
    example: '2026-10-31T00:00:00.000Z',
    description: 'Target deadline (ISO string)',
  })
  @IsString()
  @IsNotEmpty()
  deadline: string;

  @ApiPropertyOptional({
    example: 'smartphone',
    description: 'Icon key: smartphone | plane | target',
  })
  @IsOptional()
  @IsString()
  icon?: string;
}
