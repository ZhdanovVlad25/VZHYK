import * as Sentry from '@sentry/nextjs';

// Опційно — без NEXT_PUBLIC_SENTRY_DSN нічого не робить. Client-side DSN обов'язково
// публічний (NEXT_PUBLIC_*), бо потрапляє в бандл браузера — це нормально для Sentry DSN.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: 0.1,
  });
}
