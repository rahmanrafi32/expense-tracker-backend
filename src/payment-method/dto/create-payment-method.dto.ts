import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
