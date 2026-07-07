import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonResponse } from '../dto/common-response.dto';
import { Response } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const res = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof CommonResponse) return data;

        if (
          data &&
          typeof data === 'object' &&
          'success' in (data as Record<string, unknown>) &&
          'statusCode' in (data as Record<string, unknown>) &&
          'message' in (data as Record<string, unknown>)
        ) {
          return data as Record<string, unknown>;
        }

        const statusCode: number = (res && res.statusCode) || HttpStatus.OK;
        const defaultMessage = (HttpStatus as any)[statusCode] || 'Success';

        return new CommonResponse(true, statusCode, defaultMessage, data);
      }),
    );
  }
}
