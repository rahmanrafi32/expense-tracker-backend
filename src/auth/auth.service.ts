import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { PrismaService } from '../database/prisma.service';
import { compare, genSalt, hash } from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common';
import { UserValidationResult } from '../common';
import { TokenUtil } from './token.util';
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

  async login(user: UserValidationResult): Promise<CommonResponse> {
    try {
      const payload = {
        email: user.email,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePic: user.profilePic,
      };
      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '1d') as StringValue,
      });
      const refreshToken = await this.generateRefreshToken(user.id);
      return new CommonResponse(true, HttpStatus.OK, 'Login successful', {
        access_token: accessToken,
        refresh_token: refreshToken,
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to login';
      const stack = error instanceof Error ? error.stack : undefined;
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        stack,
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

  async refreshAccessToken(refreshToken: string): Promise<CommonResponse> {
    try {
      const tokenHash = TokenUtil.hashToken(refreshToken);

      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: {
          tokenHash,
        },
        include: {
          user: true,
        },
      });

      if (!tokenRecord) {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Invalid refresh token',
        );
      }

      if (tokenRecord.expiresAt < new Date()) {
        await this.prisma.refreshToken.delete({
          where: {
            id: tokenRecord.id,
          },
        });

        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Refresh token expired',
        );
      }

      const newRefreshToken = await this.generateRefreshToken(
        tokenRecord.user.id,
        tokenRecord.userAgent ?? undefined,
        tokenRecord.ipAddress ?? undefined,
      );

      await this.prisma.refreshToken.delete({
        where: {
          id: tokenRecord.id,
        },
      });

      const payload = {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
      };

      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '1d') as StringValue,
      });

      return new CommonResponse(
        true,
        HttpStatus.OK,
        'Token refreshed successfully',
        {
          access_token: accessToken,
          refresh_token: newRefreshToken,
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
    const GENERIC_MESSAGE = 'A reset link has been sent to your email.';

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
