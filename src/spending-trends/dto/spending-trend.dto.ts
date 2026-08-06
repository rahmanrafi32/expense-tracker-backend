import {
  IsInt,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetSpendingTrendDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000000' })
  @IsNotEmpty()
  @IsUUID()
  bookId: string;

  @ApiPropertyOptional({
    example: 3,
    default: 3,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  months?: number;
}
