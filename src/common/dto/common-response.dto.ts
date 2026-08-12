import { ApiProperty } from '@nestjs/swagger';

export class CommonResponse<T = unknown> {
  @ApiProperty({ example: true })
  public readonly success: boolean;

  @ApiProperty({ example: 200 })
  public readonly statusCode: number;

  @ApiProperty({ example: 'OK' })
  public readonly message: string;

  @ApiProperty({ required: false })
  public readonly data?: T;

  constructor(success: boolean, statusCode: number, message: string, data?: T) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}
