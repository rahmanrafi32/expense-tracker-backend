import { IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetCashFlowDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000000' })
  @IsUUID()
  bookId: string;

  @ApiProperty({
    example: 90,
    description: 'Number of days to project',
    required: false,
    default: 90,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @Max(365)
  days?: number;
}

export class CashFlowDayDto {
  date: string;
  balance: number;
  isShortfall: boolean;
}
