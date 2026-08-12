import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  Res,
  Req,
  HttpStatus,
  Get,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { CommonResponse } from '../common';
import {
  type UserLoginCredentials,
  type UserValidationResult,
} from './types/auth.types';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from './dto/password-reset.dto';
import { Throttle } from '@nestjs/throttler';
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
} from './utils/cookies.utils';

import type { Response, Request } from 'express';
import { AuthGuard } from '@nestjs/passport';
import type { AuthenticatedRequest } from '../common';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async me(@Req() request: AuthenticatedRequest): Promise<CommonResponse> {
    return this.authService.getUserById(request.user.userId);
  }

  @Post('login')
  async login(
    @Body() body: UserLoginCredentials,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommonResponse> {
    const user: UserValidationResult | null =
      await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);

    if (!result.success || !result.data) {
      return result;
    }

    const { access_token, refresh_token } = result.data;

    response.cookie(
      'access_token',
      access_token,
      getAccessTokenCookieOptions(),
    );

    response.cookie(
      'refresh_token',
      refresh_token,
      getRefreshTokenCookieOptions(),
    );

    return new CommonResponse(true, 200, 'Login successful');
  }

  @Post('signup')
  @ApiOperation({ summary: 'Create a new user (signup)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async signup(@Body() createUserDto: CreateUserDto): Promise<CommonResponse> {
    return this.authService.signup(createUserDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Access and refresh tokens refreshed successfully',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommonResponse> {
    const refreshToken = this.getCookieValue(request, 'refresh_token');

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

    if (!result.success || !result.data) {
      if (result.statusCode === 401) {
        this.clearAuthCookies(response);
      }

      return result;
    }

    const { access_token: accessToken, refresh_token: newRefreshToken } =
      result.data;

    response.cookie('access_token', accessToken, getAccessTokenCookieOptions());

    response.cookie(
      'refresh_token',
      newRefreshToken,
      getRefreshTokenCookieOptions(),
    );

    return new CommonResponse(
      true,
      HttpStatus.OK,
      'Token refreshed successfully',
    );
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Refresh token revoked' })
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommonResponse> {
    const refreshToken = this.getCookieValue(request, 'refresh_token');

    if (refreshToken) {
      await this.authService.revokeRefreshToken(refreshToken);
    }

    this.clearAuthCookies(response);

    return new CommonResponse(true, 200, 'Logged out successfully');
  }

  @Throttle({ default: { limit: 2, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  private getCookieValue(request: Request, name: string): string | undefined {
    const cookies: unknown = request.cookies;

    if (typeof cookies !== 'object' || cookies === null) {
      return undefined;
    }

    const value = (cookies as Record<string, unknown>)[name];
    return typeof value === 'string' ? value : undefined;
  }

  private clearAuthCookies(response: Response): void {
    response.clearCookie('access_token', getAccessTokenCookieOptions());
    response.clearCookie('refresh_token', getRefreshTokenCookieOptions());
  }
}
