import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StringValue } from 'ms';
import { PrismaService } from '../database/prisma.service';
import { compare, hash } from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common';
import { UserValidationResult } from '../common';
import { TokenUtil } from './token.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<UserValidationResult | null> {
    const totalStart = performance.now();
    const dbStart = performance.now();
    const user = await this.prisma.user.findUnique({ where: { email } });
    console.log('findUnique:', performance.now() - dbStart);
    const bcryptStart = performance.now();
    const isValid = user && (await compare(pass, user.password));
    console.log('bcrypt:', performance.now() - bcryptStart);
    console.log('validateUser total:', performance.now() - totalStart);
    return isValid ? user : null;
  }

  async login(user: UserValidationResult): Promise<CommonResponse> {
    try {
      const payload = {
        email: user.email,
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
      };
      const accessToken = this.jwtService.sign<typeof payload>(payload, {
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

    const insertStart = performance.now();
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    console.log('refreshToken create:', performance.now() - insertStart);
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

      /**
       * ROTATE TOKEN
       */

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
}
