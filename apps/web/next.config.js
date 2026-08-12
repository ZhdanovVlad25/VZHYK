/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

module.exports = nextConfig;
