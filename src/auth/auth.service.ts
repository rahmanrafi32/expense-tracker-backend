import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { compare, hash } from 'bcrypt';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common/dto/common-response.dto';
import { v4 as uuid } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(
    email: string,
    pass: string,
  ): Promise<{
    email: string;
    id: string;
  } | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && (await compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: { email: string; id: string }): Promise<CommonResponse> {
    try {
      const payload = { email: user.email, sub: user.id };
      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: process.env.JWT_EXPIRATION_TIME || '1d',
      });
      const refreshToken = await this.generateRefreshToken(user.id);
      return new CommonResponse(true, HttpStatus.OK, 'Login successful', {
        access_token: accessToken,
        refresh_token: refreshToken.token,
      });
    } catch (error) {
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to login',
        error.stack,
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

      return new CommonResponse(
        true,
        HttpStatus.CREATED,
        'User registered successfully',
        userWithoutPassword,
      );
    } catch (error) {
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to register user',
        error.stack,
      );
    }
  }

  async generateRefreshToken(userId: string): Promise<{
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
  }> {
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
      const tokenRecord = await this.prisma.refreshToken.findFirst({
        where: {
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!tokenRecord || !tokenRecord.user) {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Invalid or expired refresh token',
        );
      }

      const isValid = await compare(refreshToken, tokenRecord.token);
      if (!isValid) {
        return new CommonResponse(
          false,
          HttpStatus.UNAUTHORIZED,
          'Invalid refresh token',
        );
      }

      const payload = {
        email: tokenRecord.user.email,
        sub: tokenRecord.user.id,
      };
      const accessToken = this.jwtService.sign(payload, {
        secret: process.env.JWT_SECRET || 'your_jwt_secret',
        expiresIn: process.env.JWT_EXPIRATION_TIME || '1d',
      });

      return new CommonResponse(
        true,
        HttpStatus.OK,
        'Access token refreshed successfully',
        { access_token: accessToken },
      );
    } catch (error) {
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to refresh token',
        error.stack,
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
    } catch (error) {
      return new CommonResponse(
        false,
        HttpStatus.INTERNAL_SERVER_ERROR,
        error.message || 'Failed to revoke refresh token',
        error.stack,
      );
    }
  }
}
