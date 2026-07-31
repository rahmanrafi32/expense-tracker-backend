import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';

export enum EmergencyEntryType {
  WITHDRAWAL = 'WITHDRAWAL',
  REPAYMENT = 'REPAYMENT',
}

export class CreateEmergencyFundsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({ enum: EmergencyEntryType })
  @IsEnum(EmergencyEntryType)
  type: EmergencyEntryType;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amount: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  remark: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  date?: string;
}
