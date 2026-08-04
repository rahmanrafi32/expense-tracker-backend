import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../user/dto/create-user.dto';
import { AuthGuard } from '@nestjs/passport';
import { CommonResponse } from '../common';
import * as types from '../common';

@Controller('auth')
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Returns access and refresh tokens',
  })
  async login(
    @Body() body: types.UserLoginCredentials,
  ): Promise<CommonResponse> {
    const user: types.UserValidationResult | null =
      await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('signup')
  @ApiOperation({ summary: 'Create a new user (signup)' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async signup(@Body() createUserDto: CreateUserDto): Promise<CommonResponse> {
    return this.authService.signup(createUserDto);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({ status: 200, description: 'Returns new access token' })
  async refresh(
    @Body('refresh_token') refreshToken: string,
  ): Promise<CommonResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.refreshAccessToken(refreshToken);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('logout')
  @ApiOperation({ summary: 'Logout and revoke refresh token' })
  @ApiResponse({ status: 200, description: 'Refresh token revoked' })
  async logout(
    @Body('refresh_token') refreshToken: string,
  ): Promise<CommonResponse> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    return this.authService.revokeRefreshToken(refreshToken);
  }
}
