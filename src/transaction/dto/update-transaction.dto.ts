import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class UpdateTransactionDto {
  @IsOptional()
  @IsEnum(TransactionType, {
    message: 'Type must be a valid transaction type',
  })
  type?: TransactionType;

  @IsOptional()
  @IsDateString(
    {},
    {
      message: 'Date must be a valid ISO 8601 date string (e.g., YYYY-MM-DD)',
    },
  )
  date?: string;

  @IsOptional()
  @IsNumber(
    {},
    {
      message: 'Amount must be a valid number',
    },
  )
  amount?: number;

  @IsOptional()
  @IsString({
    message: 'Remark must be a valid string',
  })
  remark?: string;

  @IsOptional()
  @IsString({
    message: 'Category must be a valid string',
  })
  category?: string;

  @IsOptional()
  @IsString({
    message: 'Payment method must be a valid string',
  })
  paymentMethod?: string;
}
