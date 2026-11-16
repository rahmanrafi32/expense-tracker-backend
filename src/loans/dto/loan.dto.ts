import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
  IsUUID,
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  Matches,
  ValidateIf,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { LoanDirection } from '@prisma/client';

export class LoanPaymentDto {
  @ApiProperty({ example: '100.00' })
  @Matches(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/)
  amount: string;

  @ApiProperty({ example: '2026-11-16' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @ApiProperty()
  @IsUUID()
  paymentMethodId: string;

  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class CreateLoanDto extends LoanPaymentDto {
  @ApiProperty()
  @IsUUID()
  bookId: string;

  @ApiProperty({ enum: LoanDirection })
  @IsEnum(LoanDirection)
  direction: LoanDirection;

  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  personName: string;

  @ApiProperty({ example: '2026-12-16' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedPayoffDate: string;
}

export class UpdateLoanDto {
  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  personName?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  expectedPayoffDate?: string;

  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export enum LoanStatus {
  OPEN = 'OPEN',
  PARTIALLY_REPAID = 'PARTIALLY_REPAID',
  SETTLED = 'SETTLED',
}
export class LoanBookQueryDto {
  @ApiProperty()
  @IsUUID()
  bookId: string;
}
export class LoanQueryDto extends LoanBookQueryDto {
  @ApiPropertyOptional({ enum: LoanDirection })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(LoanDirection)
  direction?: LoanDirection;

  @ApiPropertyOptional({ enum: LoanStatus })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(LoanStatus)
  status?: LoanStatus;

  @ApiPropertyOptional()
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ default: 0 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @ApiPropertyOptional({ default: 20 })
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
