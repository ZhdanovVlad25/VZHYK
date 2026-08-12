import * as Sentry from '@sentry/node';

/**
 * Опційний — без SENTRY_DSN нічого не робить (no-op), не потребує реального акаунту,
 * щоб код можна було задеплоїти вже зараз. Викликається одноразово з main.ts до
 * NestFactory.create().
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}

export function captureException(exception: unknown): void {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(exception);
  }
}
