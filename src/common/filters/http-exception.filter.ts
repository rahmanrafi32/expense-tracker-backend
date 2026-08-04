import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { CommonResponse } from '../dto/common-response.dto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const excResponse = exception.getResponse();

      if (typeof excResponse === 'string') {
        message = excResponse;
      } else if (typeof excResponse === 'object' && excResponse !== null) {
        // Nest validation and other exceptions often provide { message, error, statusCode }
        // Prefer message property if present, otherwise stringify
        const body = excResponse as Record<string, unknown>;
        if ('message' in body) {
          const mb = body.message;
          message = Array.isArray(mb) ? mb.join(', ') : String(mb);
        } else if ('error' in body) {
          message = String(body.error);
        } else {
          message = JSON.stringify(body);
        }
        details = body as unknown;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = exception.stack;
    }

    this.logger.error(
      `Status ${status} Error: ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    const payload = new CommonResponse(false, status, message, details);

    response.status(status).json(payload);
  }
}
