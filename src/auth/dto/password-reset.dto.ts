import {
  IsString,
  IsEmail,
  IsNotEmpty,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RequestPasswordResetDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({
    example: 'P@ssw0rd!',
    description: 'Password (min 6 chars, include special character)',
  })
  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @Matches(/^(?=.*[!@#$%^&*])[\w!@#$%^&*]{6,}$/, {
    message: 'Password must contain at least one special character.',
  })
  password: string;
}
