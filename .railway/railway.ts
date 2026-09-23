import { defineRailway, github, postgres, preserve, project, redis, service, volume } from "railway/iac";

export default defineRailway(() => {
  const Redis = redis("Redis", { region: "ams" });
  Redis.deploy = { startCommand: "/bin/sh -c \"rm -rf $RAILWAY_VOLUME_MOUNT_PATH/lost+found/ && exec docker-entrypoint.sh redis-server --requirepass $REDIS_PASSWORD --save 60 1 --dir $RAILWAY_VOLUME_MOUNT_PATH\"" };
  const Postgres = postgres("Postgres", { region: "ams" });
  const postgresVolume = volume("postgres-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "ams", sizeMB: 500 });
  const redisVolume = volume("redis-volume", { alerts: { usage: { "100": {}, "80": {}, "95": {} } }, allowOnlineResize: true, region: "ams", sizeMB: 500 });

  // Обидва Dockerfile (apps/api/Dockerfile, apps/web/Dockerfile) написані з розрахунком
  // на build-контекст у КОРЕНІ монорепо (COPY package.json, COPY packages, npm workspaces) —
  // тому rootDirectory свідомо НЕ виставляємо, лише dockerfilePath.
  const api = service("api", {
    source: github("ZhdanovVlad25/VZHYK"),
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/api/Dockerfile" },
    // Раніше міграції не запускались автоматично ніде (docker-compose.prod.yml — окремий
    // self-hosted шлях, не цей Railway-деплой) — нова міграція, змержена в main, просто
    // ніколи не діставалась до продакшн-БД, попри задеплоєний код, що вже на неї покладався
    // (напр. AddJobListingTypes1754802700000: без прогону enum listing_type_enum лишався
    // старим, і публікація будь-якого оголошення в "Робота" падала з 500). preDeployCommand
    // виконується в тому самому контейнері з тим самим env (DATABASE_URL і т.д.) ПЕРЕД тим,
    // як новий реліз почне приймати трафік. Проти dist/database/data-source.js (не
    // src/... через typeorm-ts-node-commonjs) — production-стадія Dockerfile копіює лише
    // dist, без вихідників/ts-node; перевірено живцем локально проти чистого Postgres 16
    // тим самим `npx typeorm migration:run -d dist/database/data-source.js`.
    preDeployCommand: "npx typeorm migration:run -d dist/database/data-source.js",
    env: {
      NODE_ENV: "production",
      DATABASE_URL: Postgres.env.DATABASE_URL,
      REDIS_URL: Redis.env.REDIS_URL,
      // preserve() — секрет уже виставлений на живому сервісі; значення навмисно НЕ живе
      // в git (це б означало реальний JWT-секрет продакшну відкритим текстом у репозиторії).
      JWT_ACCESS_SECRET: preserve(),
      JWT_ACCESS_TTL: "15m",
      JWT_REFRESH_SECRET: preserve(),
      JWT_REFRESH_TTL: "30d",
      JWT_KID: "prod-key-1",
      // TurboSMS відхилив реєстрацію sender name для фізосіб (потрібен ФОП/ТОВ) — перейшли
      // на Twilio (приймає фізосіб, реєстрація по карті). TURBOSMS_* лишені на випадок
      // повернення до нього пізніше (напр. якщо оформиться ФОП).
      SMS_PROVIDER: "twilio",
      TWILIO_ACCOUNT_SID: preserve(),
      TWILIO_AUTH_TOKEN: preserve(),
      TWILIO_FROM_NUMBER: preserve(),
      TURBOSMS_TOKEN: preserve(),
      TURBOSMS_SENDER: preserve(),
      // Постійний код лише для одного адмін-номера (auth.service.ts requestOtp()) —
      // значення навмисно не в git, лише на живому сервісі.
      FIXED_OTP_PHONE: preserve(),
      FIXED_OTP_CODE: preserve(),
      // Cloudflare R2 (S3-сумісний) — bucket "vzhyk-media", account-scoped API token
      // з правами Object Read & Write, обмежений саме цим bucket'ом.
      S3_ENDPOINT: preserve(),
      S3_REGION: "auto",
      S3_BUCKET: "vzhyk-media",
      S3_ACCESS_KEY: preserve(),
      S3_SECRET_KEY: preserve(),
      S3_FORCE_PATH_STYLE: "true",
      // Кома-розділений список (main.ts resolveCorsOrigin) — кастомний домен першим (WEB_ORIGIN
      // читається і тут для CORS, і в auth.controller.ts googleCallback() для redirect — бере
      // .split(',')[0], тож порядок важливий), Railway-домен другим на перехідний період.
      WEB_ORIGIN: "https://www.vzhyk.in.ua,https://web-production-baba8.up.railway.app",
      GOOGLE_OAUTH_CLIENT_ID: preserve(),
      GOOGLE_OAUTH_CLIENT_SECRET: preserve(),
      // Кастомний домен api.vzhyk.in.ua (SSL verified) — раніше сирий Railway-URL, через що
      // Google на екрані вибору акаунта показував користувачу технічний домен замість бренду.
      GOOGLE_OAUTH_CALLBACK_URL: "https://api.vzhyk.in.ua/api/v1/auth/google/callback",
      // Той самий Sentry DSN, що й web — один невеликий проєкт на обидва сервіси поки що.
      SENTRY_DSN: preserve(),
      // "Модерація поштою" (moderation-email.service.ts) — лист з фото/описом і кнопками
      // Схвалити/Відхилити на кожне нове оголошення.
      EMAIL_PROVIDER: "gmail",
      GMAIL_USER: preserve(),
      GMAIL_APP_PASSWORD: preserve(),
      MODERATION_NOTIFY_EMAIL: "zhdanov.vlad.work@gmail.com",
      MODERATION_EMAIL_SECRET: preserve(),
      // Telegram-сповіщення про нову справу на модерації (moderation-email.service.ts
      // sendTelegramNotification) — той самий необов'язковий канал, що email, паралельно.
      TELEGRAM_BOT_TOKEN: preserve(),
      TELEGRAM_CHAT_ID: "531788003",
      API_PUBLIC_URL: "https://api-production-ee5b.up.railway.app",
    },
  });

  const web = service("web", {
    source: github("ZhdanovVlad25/VZHYK"),
    build: { builder: "DOCKERFILE", dockerfilePath: "apps/web/Dockerfile" },
    env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api-production-ee5b.up.railway.app/api/v1",
      // Кастомний домен (docs: домен verified, SSL live) — не сирий Railway-URL.
      NEXT_PUBLIC_SITE_URL: "https://www.vzhyk.in.ua",
      NEXT_PUBLIC_SENTRY_DSN: preserve(),
      // Google Search Console verification meta-тег (layout.tsx metadata.verification.google) —
      // не в IaC-файлі раніше, тому план бачив її як "зайву" й хотів видалити.
      GOOGLE_SITE_VERIFICATION: preserve(),
    },
  });

  return project("fortunate-light", {
    resources: [Redis, Postgres, postgresVolume, redisVolume, api, web],
  });
});
