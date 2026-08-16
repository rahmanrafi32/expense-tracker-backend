import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class CronGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const authorization = request.get('authorization');
    const expectedToken = process.env.CRON_SECRET;

    if (!expectedToken) {
      throw new Error('CRON_SECRET is not configured');
    }

    if (authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
