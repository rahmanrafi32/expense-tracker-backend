import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { TransactionType } from '../enums/transaction-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTransactionDto {
  @ApiProperty({
    example: '00000000-0000-4000-8000-000000000000',
    description: 'Book UUID',
  })
  @IsNotEmpty({ message: 'Book ID is required' })
  @IsUUID('all', { message: 'Book ID must be a valid UUID' })
  bookId: string;

  @ApiProperty({ example: 'INCOME', enum: TransactionType })
  @IsNotEmpty({ message: 'Transaction type is required' })
  @IsEnum(TransactionType, { message: 'Type must be a valid transaction type' })
  type: TransactionType;

  @ApiProperty({ example: '2026-06-04', description: 'ISO date string' })
  @IsNotEmpty({ message: 'Date is required' })
  @IsDateString(
    {},
    { message: 'Date must be a valid ISO 8601 date string (e.g., YYYY-MM-DD)' },
  )
  date: string;

  @ApiProperty({ example: 100.5, description: 'Transaction amount' })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsDecimal(
    { decimal_digits: '0,2', force_decimal: false },
    {
      message:
        'Amount must be a valid decimal number with up to 2 decimal places',
    },
  )
  amount: string;

  @ApiProperty({ example: 'Salary for June', required: false })
  @IsOptional()
  @IsString({ message: 'Remark must be a valid string' })
  remark?: string;

  @ApiProperty({
    example: '99348009-2d8d-4617-b56a-2871ec12b13d',
    description: 'Category UUID',
  })
  @IsNotEmpty({
    message: 'Category ID is required',
  })
  @IsUUID('all', {
    message: 'Category ID must be a valid UUID',
  })
  categoryId: string;

  @ApiProperty({
    example: '11111111-2222-4333-8444-555555555555',
    description: 'Payment method UUID',
  })
  @IsNotEmpty({
    message: 'Payment method ID is required',
  })
  @IsUUID('all', {
    message: 'Payment method ID must be a valid UUID',
  })
  paymentMethodId: string;
}
