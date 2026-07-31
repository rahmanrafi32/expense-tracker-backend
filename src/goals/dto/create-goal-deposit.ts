import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateGoalDepositDto {
  @ApiProperty({ example: 5000 })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiPropertyOptional({ example: 'Salary contribution' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    example: '2026-07-27T00:00:00.000Z',
    description: 'Deposit date (defaults to now)',
  })
  @IsOptional()
  @IsString()
  date?: string;
}
