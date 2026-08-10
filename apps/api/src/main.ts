import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Версіонування через префікс /api/v1 (див. docs/api.md)
  app.setGlobalPrefix('api/v1');

  // Суворі DTO-схеми, whitelist полів (docs/security.md §3)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Єдиний формат помилок { error: { code, message, details, traceId } } (docs/api.md §1)
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[vzhyk-api] listening on port ${port}`);
}

bootstrap();
