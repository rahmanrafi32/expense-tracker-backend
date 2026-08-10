import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsOptional, IsString } from 'class-validator';

export class CreateGoalDepositDto {
  @ApiProperty({
    example: '5000.00',
    description: 'Contribution amount',
  })
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  amount: string;

  @ApiPropertyOptional({
    example: 'Salary contribution',
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: '2026-07-27T00:00:00.000Z',
    description: 'Deposit date. Defaults to now.',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
