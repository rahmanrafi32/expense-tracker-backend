import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSinkingFundDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000000' })
  @IsNotEmpty()
  @IsUUID()
  bookId: string;

  @ApiProperty({ example: 'Car Servicing' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 15000 })
  @IsNotEmpty()
  @IsNumber()
  targetAmount: number;

  @ApiProperty({ example: '2026-11-30' })
  @IsNotEmpty()
  @IsDateString()
  deadline: string;

  @ApiProperty({ example: 'wrench', required: false })
  @IsOptional()
  @IsString()
  category: string;
}
