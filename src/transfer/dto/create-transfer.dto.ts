import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateTransferDto {
  @IsString()
  @IsNotEmpty()
  sourceBookId: string;

  @IsString()
  @IsNotEmpty()
  targetBookId: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  remark?: string;
}
