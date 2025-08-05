import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profilePic: string | null;
  address: string | null;
  phoneNumber: string | null;
  password: string;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
}
export interface UserLoginCredentials {
  email: string;
  password: string;
}

export interface UserValidationResult {
  email: string;
  id: string;
}

export interface RefreshToken {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  user: User;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
}

export interface JwtPayload {
  email: string;
  sub: string;
}

export interface JwtValidationPayload {
  sub: string;
  email: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentMethod {
  id: string;
  name: string;
  isDefault: boolean;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Book {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Transaction {
  id: string;
  amount: number;
  description: string | null;
  date: Date;
  type: TransactionType;
  categoryId: string | null;
  paymentMethodId: string | null;
  bookId: string;
  createdAt: Date;
  updatedAt: Date;
}

export enum TransactionType {
  CASH_IN = 'CASH_IN',
  CASH_OUT = 'CASH_OUT',
}
