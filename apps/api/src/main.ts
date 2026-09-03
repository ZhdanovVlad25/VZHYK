import 'reflect-metadata';
import { setDefaultResultOrder } from 'dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';
import { initSentry } from './shared/sentry';
import { JsonLogger } from './shared/json-logger';

// Railway (і деякі інші контейнерні мережі) резолвлять зовнішні хости в IPv6 (AAAA), але
// не мають робочого IPv6-маршруту назовні — TCP-з'єднання падає з ENETUNREACH замість
// одразу пробувати IPv4. Знайдено на живому прикладі: GmailSmtpProvider (nodemailer) не
// чіпляв власний `family: 4` в опціях транспорту, тож фікс — на рівні Node.js DNS,
// глобально для всього процесу, а не per-provider.
setDefaultResultOrder('ipv4first');

function resolveCorsOrigin(): boolean | string | string[] {
  if (process.env.NODE_ENV !== 'production') {
    return true; // dev/test: довільний origin (localhost:3000, Playwright, різні порти) — зручність важливіша
  }
  const webOrigin = process.env.WEB_ORIGIN;
  if (!webOrigin) {
    // Свідомо fail fast, а не мовчки відкат на дозвіл усіх origin — саме цього ми уникаємо.
    throw new Error(
      "WEB_ORIGIN не задано — обов'язковий у production для звуження CORS (docs/security.md).",
    );
  }
  // Кома-розділений список — потрібно на перехідний період, коли сайт доступний і зі
  // старого Railway-домену, і з власного (vzhyk.in.ua). Одиночне значення (без коми)
  // лишається валідним рядком, як і раніше.
  const origins = webOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  return origins.length > 1 ? origins : origins[0];
}

async function bootstrap() {
  initSentry();

  const app = await NestFactory.create(AppModule, {
    cors: { origin: resolveCorsOrigin() },
    // JSON-логи для колектора в production (docs/deployment.md §6); у dev лишається
    // звичний кольоровий Nest-логер (undefined = дефолт).
    logger:
      process.env.NODE_ENV === 'production' ? new JsonLogger() : undefined,
  });

  // Security headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy тощо (docs/security.md §4)
  app.use(helmet());

  // Версіонування через префікс /api/v1 (див. docs/api.md). /health лишається поза
  // версіонуванням — стабільний шлях для LB/оркестратора незалежно від версії API.
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

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
