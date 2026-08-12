const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Мінімальний runtime-образ для Docker (apps/web/Dockerfile production stage) —
  // .next/standalone містить лише трасовані залежності замість повного node_modules.
  output: 'standalone',
  images: {
    // dev MinIO (docker-compose, S3_ENDPOINT=http://localhost:9000 у .env.example). Продакшн
    // деплой має додати сюди реальний S3/CDN-хост — next/image відмовляється оптимізувати
    // зображення з хостів поза цим списком.
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/vzhyk-media/**',
      },
    ],
  },
};

// withSentryConfig без SENTRY_AUTH_TOKEN просто пропускає source-map upload (warning,
// не error) — не потребує реального Sentry-акаунту, щоб задеплоїти код вже зараз.
module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  webpack: { treeshake: { removeDebugLogging: true } },
});
