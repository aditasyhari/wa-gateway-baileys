import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security: HTTP headers hardening
  app.use(helmet());

  // Security: CORS - restrict in production
  app.enableCors();

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Validation: reject requests with unexpected properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  await app.listen(port);
  console.log(`🚀 WA Gateway running on http://localhost:${port}/api`);
}
bootstrap();
