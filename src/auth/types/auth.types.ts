import { type User } from '@prisma/client';

export interface UserLoginCredentials {
  email: string;
  password: string;
}

export type UserValidationResult = Omit<User, 'password'>;

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface JwtValidationPayload {
  id: string;
  email: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}
