import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Food', description: 'Category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
