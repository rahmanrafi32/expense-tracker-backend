import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';
import { DatabaseModule } from '../database/database.module';
import { EmailNotificationModule } from '../email-notification/email-notification.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your_jwt_secret',
      signOptions: { expiresIn: '1d' },
    }),
    EmailNotificationModule,
  ],
  providers: [AuthService, JwtStrategy, DatabaseModule],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
