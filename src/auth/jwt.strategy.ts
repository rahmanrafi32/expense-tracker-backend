import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { type AuthenticatedUser } from '../common';
import { type JwtValidationPayload } from './types/auth.types';

const cookieExtractor = (request: Request): string | null => {
  const cookies = request.cookies as Record<string, unknown>;
  const accessToken = cookies.access_token;

  return typeof accessToken === 'string' ? accessToken : null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  validate(payload: JwtValidationPayload): AuthenticatedUser {
    return {
      userId: payload.sub,
    };
  }
}
