import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCategoryDto {
  @ApiProperty({ example: 'Groceries', description: 'Updated category name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
