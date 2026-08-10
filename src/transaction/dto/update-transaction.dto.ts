import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TransactionType } from '../enums/transaction-type.enum';

export class UpdateTransactionDto {
  @IsOptional()
  @ApiProperty({ example: 'INCOME', enum: TransactionType, required: false })
  @IsEnum(TransactionType, {
    message: 'Type must be a valid transaction type',
  })
  type?: TransactionType;

  @IsOptional()
  @ApiProperty({ example: '2026-06-04', required: false })
  @IsDateString(
    {},
    {
      message: 'Date must be a valid ISO 8601 date string (e.g., YYYY-MM-DD)',
    },
  )
  date?: string;

  @IsOptional()
  @ApiProperty({ example: 55.5, required: false })
  @IsDecimal(
    { decimal_digits: '0,2', force_decimal: false },
    {
      message:
        'Amount must be a valid decimal number with up to 2 decimal places',
    },
  )
  amount?: string;

  @IsOptional()
  @ApiProperty({ example: 'Bought coffee', required: false })
  @IsString({
    message: 'Remark must be a valid string',
  })
  remark?: string;

  @ApiPropertyOptional({
    example: '99348009-2d8d-4617-b56a-2871ec12b13d',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Category ID must be a valid UUID',
  })
  categoryId?: string;

  @ApiPropertyOptional({
    example: '11111111-2222-4333-8444-555555555555',
  })
  @IsOptional()
  @IsUUID('all', {
    message: 'Payment method ID must be a valid UUID',
  })
  paymentMethodId?: string;
}
