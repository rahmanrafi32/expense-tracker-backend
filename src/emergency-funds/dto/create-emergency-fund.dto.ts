import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsDecimal,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { EmergencyEntryType } from '../enums/emergency-entry-type.enum';

export { EmergencyEntryType } from '../enums/emergency-entry-type.enum';

export class CreateEmergencyFundsDto {
  @ApiProperty({ example: 'uuid-of-book' })
  @IsUUID()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({
    enum: EmergencyEntryType,
    example: EmergencyEntryType.WITHDRAWAL,
  })
  @IsEnum(EmergencyEntryType)
  type: EmergencyEntryType;

  @ApiProperty({
    example: '5000.00',
    description: 'Emergency fund amount',
  })
  @IsDecimal({
    decimal_digits: '0,2',
    force_decimal: false,
  })
  amount: string;

  @ApiProperty({
    example: 'Medical emergency',
  })
  @IsString()
  @IsNotEmpty()
  remark: string;

  @ApiProperty({
    example: 'uuid-of-category',
    description: 'Category ID',
  })
  @IsUUID()
  @IsNotEmpty()
  categoryId: string;

  @ApiProperty({
    example: 'uuid-of-payment-method',
    description: 'Payment method ID',
  })
  @IsUUID()
  @IsNotEmpty()
  paymentMethodId: string;

  @ApiProperty({
    required: false,
    example: '2026-08-10T10:00:00.000Z',
  })
  @IsDateString()
  @IsOptional()
  date?: string;
}
