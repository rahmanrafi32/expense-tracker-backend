export class CommonResponse<T = any> {
  success: boolean;
  statusCode: number;
  message: string;
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
