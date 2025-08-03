import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateBookDto {
  @IsNotEmpty({ message: 'Book name is required' })
  @IsString({ message: 'Book name must be a string' })
  @MinLength(3, { message: 'Book name must be at least 3 characters long' })
  name: string;

  @IsNotEmpty({ message: 'User ID is required' })
  @IsUUID('4', { message: 'User ID must be a valid UUID' })
  userId: string;
}