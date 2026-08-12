import * as Sentry from '@sentry/nextjs';

// Опційно — без SENTRY_DSN нічого не робить, реальний акаунт не потрібен, щоб задеплоїти код.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}
