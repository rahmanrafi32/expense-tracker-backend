import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
