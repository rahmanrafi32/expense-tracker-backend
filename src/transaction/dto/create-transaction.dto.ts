import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '@prisma/client';

export class CreateTransactionDto {
  @IsNotEmpty({ message: 'Book ID is required' })
  @IsUUID('all', { message: 'Book ID must be a valid UUID' })
  bookId: string;

  @IsNotEmpty({ message: 'Transaction type is required' })
  @IsEnum(TransactionType, { message: 'Type must be a valid transaction type' })
  type: TransactionType;

  @IsNotEmpty({ message: 'Date is required' })
  @IsDateString(
    {},
    { message: 'Date must be a valid ISO 8601 date string (e.g., YYYY-MM-DD)' },
  )
  date: string;

  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a valid number' })
  amount: number;

  @IsOptional()
  @IsString({ message: 'Remark must be a valid string' })
  remark?: string;

  @IsOptional()
  @IsString({ message: 'Category must be a valid string' })
  category: string;

  @IsOptional()
  @IsString({ message: 'Payment method must be a valid string' })
  paymentMethod: string;
}
