import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePaymentMethodDto {
  @ApiProperty({
    example: 'Debit Card',
    description: 'Updated payment method name',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
