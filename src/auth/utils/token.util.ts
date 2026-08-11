import { createHash, randomBytes } from 'crypto';

export class TokenUtil {
  static generateRefreshToken() {
    const plainToken = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(plainToken).digest('hex');

    return { plainToken, tokenHash };
  }

  static hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
