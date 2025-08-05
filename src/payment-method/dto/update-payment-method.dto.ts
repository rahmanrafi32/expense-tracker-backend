import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
