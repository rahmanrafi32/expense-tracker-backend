import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsPhoneNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'John', description: 'First name of the user' })
  @IsString({ message: 'First name must be a string.' })
  @MinLength(1, { message: 'First name is required.' })
  firstName: string;

  @ApiProperty({ example: 'Doe', description: 'Last name of the user' })
  @IsString({ message: 'Last name must be a string.' })
  @MinLength(1, { message: 'Last name is required.' })
  lastName: string;

  @ApiProperty({
    example: 'https://...',
    description: 'Profile picture URL',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Profile picture must be a string.' })
  profilePic?: string;

  @ApiProperty({
    example: '123 Main St',
    description: 'Address',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Address must be a string.' })
  address?: string;

  @ApiProperty({
    example: '+8801XXXXXXXXX',
    description: 'Phone number',
    required: false,
  })
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'Please provide a valid phone number.' })
  phoneNumber?: string;

  @ApiProperty({ example: 'user@example.com', description: 'Email address' })
  @IsEmail({}, { message: 'Please provide a valid email address.' })
  email: string;

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

  @ApiProperty({
    example: 'Bangladesh',
    description: 'Country',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Country must be a string.' })
  country?: string;
}
