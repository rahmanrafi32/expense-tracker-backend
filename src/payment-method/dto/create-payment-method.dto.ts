import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePaymentMethodDto {
  @ApiProperty({ example: 'Credit Card', description: 'Payment method name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
