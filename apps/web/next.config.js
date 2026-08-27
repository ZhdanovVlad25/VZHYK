const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Мінімальний runtime-образ для Docker (apps/web/Dockerfile production stage) —
  // .next/standalone містить лише трасовані залежності замість повного node_modules.
  output: 'standalone',
  images: {
    // Кожен ключ у R2 унікальний (randomUUID() при завантаженні, media.service.ts) —
    // той самий URL ніколи не вказує на інший файл, тож рік кешу безпечний. Дефолтні
    // 60с (Next.js minimumCacheTTL) означали, що навіть УЖЕ оптимізоване зображення
    // перевантажувалось з R2 при кожному візиті, що не вклався в цю хвилину.
    minimumCacheTTL: 31536000,
    // next/image відмовляється оптимізувати зображення з хостів поза цим списком.
    remotePatterns: [
      {
        // dev MinIO (docker-compose, S3_ENDPOINT=http://localhost:9000 у .env.example).
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/vzhyk-media/**',
      },
      {
        // Продакшн — Cloudflare R2 (S3_ENDPOINT на api-сервісі), presigned GetObject URL.
        protocol: 'https',
        hostname: 'f942c3d3fc6dc1eb228b8198299d5b75.r2.cloudflarestorage.com',
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
