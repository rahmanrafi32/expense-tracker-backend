import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateGoalDto {
  @ApiPropertyOptional({ example: 'Buy iPhone' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 38500 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  targetAmount?: number;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  savedAmount?: number;

  @ApiPropertyOptional({ example: '2026-10-31T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  deadline?: string;

  @ApiPropertyOptional({ example: 'smartphone' })
  @IsOptional()
  @IsString()
  icon?: string;
}
