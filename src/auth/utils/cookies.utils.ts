import { CookieOptions } from 'express';

const DEFAULT_ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const DEFAULT_REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getAccessTokenMaxAge = (): number => {
  const expiration = process.env.JWT_EXPIRATION_TIME;
  const match = expiration?.match(/^(\d+)(ms|s|m|h|d|w)$/);

  if (!match) {
    return DEFAULT_ACCESS_TOKEN_MAX_AGE;
  }

  const value = Number(match[1]);
  const unit = match[2];
  const unitInMilliseconds = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  } as const;

  return value * unitInMilliseconds[unit];
};

const getRefreshTokenMaxAge = (): number => {
  const expirationDays = Number(process.env.JWT_REFRESH_TOKEN_EXPIRATION ?? 7);

  return Number.isFinite(expirationDays) && expirationDays > 0
    ? expirationDays * 24 * 60 * 60 * 1000
    : DEFAULT_REFRESH_TOKEN_MAX_AGE;
};

const getCookieSecurityOptions = (): Pick<
  CookieOptions,
  'httpOnly' | 'secure' | 'sameSite'
> => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
});

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...getCookieSecurityOptions(),
  maxAge: getAccessTokenMaxAge(),
  path: '/',
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...getCookieSecurityOptions(),
  maxAge: getRefreshTokenMaxAge(),
  path: '/auth',
});
