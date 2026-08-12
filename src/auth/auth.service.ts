import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { PrismaService } from '../database/prisma.service';
import { compare, genSalt, hash } from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common';
import { type AuthTokens, type UserValidationResult } from './types/auth.types';
import { TokenUtil } from './utils/token.util';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { createHash, randomBytes } from 'crypto';
import { EmailNotificationService } from '../email-notification/email-notification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: EmailNotificationService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserValidationResult | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await compare(pass, user.password))) {
      const { password, ...result } = user;
      void password;
      return result;
    }
    return null;
  }

  async getUserById(userId: string): Promise<CommonResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profilePic: true,
      },
    });

    if (!user) {
      return new CommonResponse(false, HttpStatus.NOT_FOUND, 'User not found');
    }

    return new CommonResponse(
      true,
      HttpStatus.OK,
      'User retrieved successfully',
      user,
    );
  }

  async login(user: UserValidationResult): Promise<CommonResponse<AuthTokens>> {
    try {
      const payload = {
        sub: user.id,
      };
      const accessToken = this.jwtService.sign(payload, {
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '15m') as StringValue,
      });
      const refreshToken = await this.generateRefreshToken(user.id);
      return new CommonResponse<AuthTokens>(
        true,
        HttpStatus.OK,
        'Login successful',
        {
          access_token: accessToken,
          refresh_token: refreshToken,
        },
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to login';
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
      );
    }
  }

  async signup(createUserDto: CreateUserDto): Promise<CommonResponse> {
    try {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: createUserDto.email },
      });
      if (existingUser) {
        return new CommonResponse(
          false,
          HttpStatus.CONFLICT,
          'Email already in use',
        );
      }

      const hashedPassword = await hash(createUserDto.password, 10);

      const user = await this.prisma.user.create({
        data: {
          ...createUserDto,
          password: hashedPassword,
        },
      });

      const { password, ...userWithoutPassword } = user;
      void password;

      return new CommonResponse(
        true,
        HttpStatus.CREATED,
        'User registered successfully',
        userWithoutPassword,
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to register user';
      const stack = error instanceof Error ? error.stack : undefined;
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        stack,
      );
    }
  }

  async generateRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const { plainToken, tokenHash } = TokenUtil.generateRefreshToken();

    const expirationDays = Number(
      process.env.JWT_REFRESH_TOKEN_EXPIRATION ?? 7,
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });
    return plainToken;
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<CommonResponse<AuthTokens>> {
    try {
      const tokenHash = TokenUtil.hashToken(refreshToken);

      const rotation = await this.prisma.$transaction(async (transaction) => {
        const tokenRecord = await transaction.refreshToken.findUnique({
          where: {
            tokenHash,
          },
          include: {
            user: true,
          },
        });

        if (!tokenRecord) {
          return { outcome: 'invalid' as const };
        }

        if (tokenRecord.expiresAt < new Date()) {
          await transaction.refreshToken.deleteMany({
            where: {
              id: tokenRecord.id,
            },
          });

          return { outcome: 'expired' as const };
        }

        const deletedToken = await transaction.refreshToken.deleteMany({
          where: {
            id: tokenRecord.id,
            tokenHash,
          },
        });

        if (deletedToken.count !== 1) {
          return { outcome: 'invalid' as const };
        }

        const { plainToken: newRefreshToken, tokenHash: newTokenHash } =
          TokenUtil.generateRefreshToken();
        const expirationDays = Number(
          process.env.JWT_REFRESH_TOKEN_EXPIRATION ?? 7,
        );
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);

        await transaction.refreshToken.create({
          data: {
            userId: tokenRecord.user.id,
            tokenHash: newTokenHash,
            expiresAt,
            userAgent: tokenRecord.userAgent,
            ipAddress: tokenRecord.ipAddress,
          },
        });

        return {
          outcome: 'success' as const,
          userId: tokenRecord.user.id,
          refreshToken: newRefreshToken,
        };
      });

      if (rotation.outcome === 'invalid') {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Invalid refresh token',
        );
      }

      if (rotation.outcome === 'expired') {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Refresh token expired',
        );
      }

      const payload = {
        sub: rotation.userId,
      };

      const accessToken = this.jwtService.sign(payload, {
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '15m') as StringValue,
      });

      return new CommonResponse<AuthTokens>(
        true,
        HttpStatus.OK,
        'Token refreshed successfully',
        {
          access_token: accessToken,
          refresh_token: rotation.refreshToken,
        },
      );
    } catch {
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to refresh token',
      );
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<CommonResponse> {
    try {
      const tokenHash = TokenUtil.hashToken(refreshToken);

      await this.prisma.refreshToken.deleteMany({
        where: {
          tokenHash,
        },
      });

      return new CommonResponse(
        true,
        HttpStatus.OK,
        'Refresh token revoked successfully',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to revoke refresh token';
      const stack = error instanceof Error ? error.stack : undefined;
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        stack,
      );
    }
  }

  async revokeAllRefreshTokens(userId: string): Promise<CommonResponse> {
    try {
      await this.prisma.refreshToken.deleteMany({
        where: {
          userId,
        },
      });

      return new CommonResponse(
        true,
        HttpStatus.OK,
        'All refresh tokens revoked successfully',
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to revoke refresh tokens';
      const stack = error instanceof Error ? error.stack : undefined;
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        stack,
      );
    }
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<CommonResponse> {
    const GENERIC_MESSAGE =
      'A password reset link has been sent to your respective email address.';

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      await genSalt(10);
      return new CommonResponse(true, HttpStatus.OK, GENERIC_MESSAGE);
    }

    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = createHash('sha256').update(rawToken).digest('hex');

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        token: hashedToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    const frontendUrl = process.env.APP_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    await this.mailService.sendPasswordResetEmail(user.email, resetLink);

    return new CommonResponse(true, HttpStatus.OK, GENERIC_MESSAGE);
  }

  async resetPassword(dto: ResetPasswordDto): Promise<CommonResponse> {
    const GENERIC_TOKEN_ERROR = 'Invalid or expired token';
    const hashedToken = createHash('sha256').update(dto.token).digest('hex');

    let resetRecord: {
      id: string;
      userId: string;
      createdAt: Date;
      expiresAt: Date;
      token: string;
    };

    try {
      resetRecord = await this.prisma.passwordResetToken.delete({
        where: { token: hashedToken },
      });
    } catch {
      return new CommonResponse(
        false,
        HttpStatus.BAD_REQUEST,
        GENERIC_TOKEN_ERROR,
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      return new CommonResponse(
        false,
        HttpStatus.BAD_REQUEST,
        GENERIC_TOKEN_ERROR,
      );
    }

    const salt = await genSalt(10);
    const hashedPassword = await hash(dto.password, salt);

    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: resetRecord.userId },
          data: { password: hashedPassword },
        }),
        this.prisma.refreshToken.deleteMany({
          where: { userId: resetRecord.userId },
        }),
      ]);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to reset password';
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
      );
    }

    return new CommonResponse(
      true,
      HttpStatus.OK,
      'Password reset successfully. Please log in.',
    );
  }
}
