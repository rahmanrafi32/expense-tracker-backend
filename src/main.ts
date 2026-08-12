import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BookModule } from './book/book.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ResponseInterceptor, AllExceptionsFilter } from './common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';

const allowedOrigins = new Set([
  'https://salmon-forest-0428d1000.7.azurestaticapps.net',
  'https://expense.minhazurrahman.me',
  'http://localhost:4173',
  'http://localhost:5173',
]);

const csrfProtection = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  const stateChangingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];

  if (!stateChangingMethods.includes(request.method)) {
    next();
    return;
  }

  const fetchSite = request.get('sec-fetch-site');
  if (fetchSite === 'same-site' || fetchSite === 'same-origin') {
    next();
    return;
  }

  if (fetchSite === 'cross-site') {
    next(new ForbiddenException('Request origin is not allowed'));
    return;
  }

  const origin = request.get('origin');

  if (!origin) {
    next();
    return;
  }

  if (!allowedOrigins.has(origin)) {
    next(new ForbiddenException('Request origin is not allowed'));
    return;
  }

  next();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: [...allowedOrigins],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  app.use(csrfProtection);

  const configService = app.get(ConfigService);
  const port: number = configService.get('PORT') || 3000;
  const config = new DocumentBuilder()
    .setTitle('Expense Tracker API')
    .setDescription('API documentation for the Expense Tracker backend')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    include: [
      AppModule,
      UserModule,
      AuthModule,
      BookModule,
      TransactionModule,
      CategoryModule,
      PaymentMethodModule,
    ],
  });
  SwaggerModule.setup('api/docs', app, document);
  await app.listen(port);
}

void bootstrap();
