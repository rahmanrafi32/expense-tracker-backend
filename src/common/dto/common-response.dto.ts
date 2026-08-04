import { ApiProperty } from '@nestjs/swagger';

export class CommonResponse<T = any> {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'OK' })
  message: string;

  @ApiProperty({ required: false })
  data?: T;

  constructor(success: boolean, statusCode: number, message: string, data?: T) {
    this.success = success;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined) {
      this.data = data;
    }
  }
}
