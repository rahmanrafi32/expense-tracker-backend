import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateGoal {
  @ApiProperty({ example: 'uuid-of-book' })
  @IsUUID()
  @IsNotEmpty()
  bookId: string;

  @ApiProperty({ example: 'Buy iPhone' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 38500 })
  @IsNumber()
  @Min(0)
  targetAmount: number;

  @ApiPropertyOptional({
    example: 15000,
    description: 'Amount already saved (default 0)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  savedAmount?: number;

  @ApiProperty({
    example: '2026-10-31T00:00:00.000Z',
    description: 'Target deadline (ISO string)',
  })
  @IsString()
  @IsNotEmpty()
  deadline: string;

  @ApiPropertyOptional({
    example: 'smartphone',
    description: 'Icon key: smartphone | plane | target',
  })
  @IsOptional()
  @IsString()
  icon?: string;
}
