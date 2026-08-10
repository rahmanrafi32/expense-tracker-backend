import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString } from 'class-validator';

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 'Buy iPhone' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example: '38500.00',
    description: 'New goal target amount',
  })
  @IsOptional()
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  targetAmount?: string;

  @ApiPropertyOptional({
    example: '2026-10-31T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiPropertyOptional({ example: 'smartphone' })
  @IsOptional()
  @IsString()
  icon?: string;
}
