import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export enum TransactionType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}

export class CreateTransactionDto {
  @IsNotEmpty({ message: 'Book ID is required' })
  @IsUUID('4', { message: 'Book ID must be a valid UUID version 4' })
  bookId: string;

  @IsNotEmpty({ message: 'Transaction type is required' })
  @IsEnum(TransactionType, {
    message: 'Transaction type must be either CASH_IN or CASH_OUT',
  })
  type: TransactionType;

  @IsNotEmpty({ message: 'Transaction date is required' })
  @IsDateString(
    { strict: true },
    {
      message:
        'Date must be in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)',
    },
  )
  date: string;

  @IsOptional()
  @IsString({ message: 'Remark must be a text string' })
  @Length(0, 255, {
    message: 'Remark cannot exceed 255 characters',
  })
  remark?: string;

  @IsNotEmpty({ message: 'Category is required' })
  @IsString({ message: 'Category must be a text string' })
  @Length(1, 100, {
    message: 'Category must be between 1 and 100 characters',
  })
  category: string;

  @IsNotEmpty({ message: 'Payment method is required' })
  @IsString({ message: 'Payment method must be a text string' })
  @Length(1, 100, {
    message: 'Payment method must be between 1 and 100 characters',
  })
  paymentMethod: string;
}
