import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';

export class CreateUserDto {
  @IsString({ message: 'First name must be a string.' })
  @MinLength(1, { message: 'First name is required.' })
  firstName: string;

  @IsString({ message: 'Last name must be a string.' })
  @MinLength(1, { message: 'Last name is required.' })
  lastName: string;

  @IsOptional()
  @IsString({ message: 'Profile picture must be a string.' })
  profilePic?: string;

  @IsOptional()
  @IsString({ message: 'Address must be a string.' })
  address?: string;

  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number.' })
  phoneNumber?: string;

  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

  @IsString({ message: 'Password must be a string.' })
  @MinLength(6, { message: 'Password must be at least 6 characters long.' })
  @Matches(/^(?=.*[!@#$%^&*])[\w!@#$%^&*]{6,}$/, {
    message: 'Password must contain at least one special character.',
  })
  password: string;

  @IsOptional()
  @IsString({ message: 'Country must be a string.' })
  country?: string;
}
