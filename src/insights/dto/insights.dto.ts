import { IsNotEmpty, IsNumber, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MonthlyInsightDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsNumber()
  year: number;
}

export class YearlyInsightDto {
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @Type(() => Number)
  @IsNumber()
  year: number;
}
