import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { compare, hash } from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common';
import { v4 as uuid } from 'uuid';
import {
  RefreshToken,
  UserValidationResult,
  RefreshTokenRecord,
} from '../common';

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
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await compare(pass, user.password))) {
      const { password: _password, ...result } = user;
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
      };
      const accessToken = this.jwtService.sign<typeof payload>(payload, {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '1d') as any,
      });
      const refreshToken = await this.generateRefreshToken(user.id);
      return new CommonResponse(true, HttpStatus.OK, 'Login successful', {
        access_token: accessToken,
        refresh_token: refreshToken.token,
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

      const { password: _password, ...userWithoutPassword } = user;

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

  async generateRefreshToken(userId: string): Promise<RefreshTokenRecord> {
    const token = uuid();
    const hashedToken = await hash(token, 10);
    const expiresAt = new Date();
    const expirationDays = process.env.JWT_REFRESH_TOKEN_EXPIRATION
      ? parseInt(process.env.JWT_REFRESH_TOKEN_EXPIRATION, 10)
      : 7;
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    return this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
      },
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<CommonResponse> {
    try {
      console.log('from service', refreshToken);
      if (!refreshToken) {
        console.log('in the if');
        return new CommonResponse(
          false,
          HttpStatus.BAD_REQUEST,
          'Invalid refresh token format',
        );
      }

      const tokenRecords: RefreshToken[] =
        await this.prisma.refreshToken.findMany({
          where: {
            expiresAt: { gt: new Date() },
          },
          include: { user: true },
        });

      if (!tokenRecords || tokenRecords.length === 0) {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'No valid refresh tokens found',
        );
      }

      let matchingTokenRecord: RefreshToken | undefined;

      for (const record of tokenRecords) {
        const isValid = await compare(refreshToken, record.token);
        if (isValid) {
          matchingTokenRecord = record;
          break;
        }
      }

      if (!matchingTokenRecord?.user) {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Invalid refresh token',
        );
      }

      const payload = {
        email: matchingTokenRecord.user.email,
        sub: matchingTokenRecord.user.id,
      };

      const accessToken = this.jwtService.sign<typeof payload>(payload, {
        secret: process.env.JWT_SECRET,
        expiresIn: (process.env.JWT_EXPIRATION_TIME || '1d') as any,
      });

      return new CommonResponse(
        true,
        HttpStatus.OK,
        'Access token refreshed successfully',
        { access_token: accessToken },
      );
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        'Failed to refresh token',
        { error: errorMessage },
      );
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<CommonResponse> {
    try {
      const hashedToken = await hash(refreshToken, 10);
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: { token: hashedToken },
      });

      if (!tokenRecord) {
        return new CommonResponse(
          false,
          HttpStatus.NOT_FOUND,
          'Refresh token not found',
        );
      }

      await this.prisma.refreshToken.delete({
        where: { id: tokenRecord.id },
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
}
