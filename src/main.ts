import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { BookModule } from './book/book.module';
import { TransactionModule } from './transaction/transaction.module';
import { CategoryModule } from './category/category.module';
import { PaymentMethodModule } from './payment-method/payment-method.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ResponseInterceptor, AllExceptionsFilter } from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: 'http://localhost:5173',
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

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
