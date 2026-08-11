import { type Request } from 'express';

export interface AuthenticatedUser {
  userId: string;
  id?: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
