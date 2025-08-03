import { IsEmail, IsString, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @Matches(/^(?=.*[!@#$%^&*])[\w!@#$%^&*]{6,}$/, {
    message: 'Password must contain at least one special character.',
  })
  password: string;
}
