# ВЖИК — Deployment

## 1. Середовища

`local (docker-compose)` → `staging` → `production`. Окремі БД, secrets, S3-buckets для кожного середовища; ніколи не використовувати production-дані в staging без анонімізації.

## 2. Локальна розробка

`docker-compose.yml`: `postgres`, `redis`, `minio` (S3-сумісне сховище), `api` (NestJS, hot reload), `web` (Next.js dev server). Один `make up` / `docker compose up` піднімає повне середовище + `seed` job.

## 3. Контейнеризація

Multi-stage Dockerfile для `api` та `web` (`apps/api/Dockerfile`, `apps/web/Dockerfile`;
build stage → slim runtime image, `apps/web` — `output: 'standalone'`). Образи
публікуються в container registry з тегом = git SHA (`.github/workflows/release.yml`,
GHCR). **Обидва Dockerfile'и явно перевірені живцем на Phase 8** (докер build + запуск
контейнерів проти реальних postgres/redis/minio) — виявлено й полагоджено 2 баги, яких
CI не ловив (не було жодного docker-build кроку в CI до Phase 8):
1. `packages/tsconfig`/`packages/eslint-config` (npm workspaces `packages/*`) не
   копіювались у build-контекст — `tsc` мовчки падав назад на дефолтний ES5-таргет
   замість `../../packages/tsconfig/base.json`, `nest build` валився з desятком
   TS-помилок. Фікс: `COPY packages ./packages` у base-стадії обох Dockerfile.
2. `apps/api` production-стадія копіювала лише `apps/api/node_modules`, а частина
   залежностей (напр. `reflect-metadata`) хоїститься npm workspaces в корінь
   `/app/node_modules` — контейнер падав одразу з `MODULE_NOT_FOUND`. Фікс: production
   стадія копіює обидва рівні `node_modules` (корінь + `apps/api`).

Продакшн self-hosted деплой: `docker-compose.prod.yml` (окремий від dev
`docker-compose.yml` — без hot-reload volumes, з health checks для api/web, без
прокинутих портів postgres/redis/minio назовні). Потребує `.env.production`
(шаблон — `.env.production.example`, сам файл у git не потрапляє). Запуск:

```bash
cp .env.production.example .env.production   # заповнити реальними значеннями
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

**Перевірено живцем**: усі 5 сервісів (`postgres`/`redis`/`minio`/`api`/`web`) стартують
разом і доходять до `healthy`, `api`/`web` реально обслуговують трафік. MinIO тут —
самодостатній S3-сумісний варіант без хмарного акаунту; для реального продакшну
зазвичай краще керований S3 (див. §5 нижче) — заміна лише в `S3_*`-змінних, без
структурних змін API.

## 4. CI/CD ✅ (мінімум для MVP)

1. **CI** (на кожен PR): lint, typecheck, unit tests, build — `.github/workflows/ci.yml`,
   job'и `api`/`web`. Плюс `integration` (Phase 7) і `docker` (Phase 8 — build обох
   production Docker-образів, `docker/build-push-action`, кеш через GHA cache).
2. **CI** (на merge в main): build & push images — `.github/workflows/release.yml`,
   тег = git SHA + `latest`, GHCR (`ghcr.io`), вбудований `GITHUB_TOKEN` (жодних
   додаткових секретів). **Ще не запускався по-справжньому**: у репозиторії немає
   GitHub remote (`git remote -v` порожній) — workflow готовий і валідний YAML,
   запрацює одразу, щойно з'явиться реальний push у GitHub.
3. **CD**: ручний/автоматичний деплой на staging → smoke tests → ручне підтвердження → деплой на production. **Не реалізовано** — залежить від конкретної інфраструктури (staging/production hosts), якої в проєкті ще нема.

Міграції БД виконуються як окремий crop-степ перед розкатуванням нової версії `api` (backward-compatible міграції: спочатку additive-зміни, видалення колонок — окремим релізом пізніше).

## 5. Infrastructure (production, орієнтовно)

- Managed PostgreSQL (з read replica за потреби на Phase 6+).
- Managed Redis.
- Object storage (AWS S3 або сумісний, з CDN перед ним для медіа).
- API за load balancer, кілька реплік `api` (stateless, окрім WS-з'єднань — sticky sessions або Redis adapter для Socket.IO).
- CDN для статики Next.js та зображень.

## 6. Моніторинг та логування ✅ (Phase 8)

- **Health check**: `GET /health` (`apps/api/src/modules/health`) — поза `/api/v1`
  (стабільний шлях для LB/оркестратора), пінгує Postgres (`SELECT 1`) і Redis (`PING`),
  503 якщо будь-що недоступне. Використовується в `docker-compose.prod.yml` healthcheck.
- **Структуровані JSON-логи**: `apps/api/src/shared/json-logger.ts` — один JSON-рядок
  на подію в stdout, підключається лише коли `NODE_ENV=production`
  (`NestFactory.create(..., { logger })` в `main.ts`); у dev лишається звичний
  кольоровий Nest-логер. Централізований collector (Loki/CloudWatch/etc.) — вибір
  конкретного інструменту поза цим MVP-зрізом, формат вже готовий до підключення будь-якого.
- **Error tracking (Sentry)**: `@sentry/node` (api, `apps/api/src/shared/sentry.ts`,
  ловить будь-яку не-`HttpException` помилку через `AllExceptionsFilter`) і
  `@sentry/nextjs` (web, `instrumentation.ts` + `sentry.server.config.ts`/
  `sentry.client.config.ts`). **Опційно** — без `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`
  повний no-op, реального акаунту не потрібно, щоб задеплоїти код зараз; коли
  з'явиться акаунт — досить виставити змінні середовища, код уже готовий.
- **Метрики (Prometheus/Grafana) та alerting** — свідомо НЕ реалізовано в цьому зрізі:
  потребують реальної observability-інфраструктури (немає в проєкті), а health-check +
  Sentry вже покривають найкритичніший MVP-мінімум ("сервіс живий" + "про помилку
  дізнаємось"). Кандидат для розширення, коли з'явиться staging/production з реальним
  трафіком.

## 7. Backup & Disaster Recovery ✅ (Phase 8, скрипт)

`scripts/backup-db.sh` — `pg_dump` через `docker compose exec postgres`, gzip,
ротація за `BACKUP_RETENTION_DAYS` (дефолт 14 днів). Приклад cron (щодня о 3:00) і
команда відновлення — коментарі на початку скрипта. **Не зроблено**: point-in-time
recovery (потребує `wal-level=replica`+WAL archiving, або керований Postgres з PITR
із коробки), реплікація object storage, задокументовані RTO/RPO — це рішення разом
із бізнесом на реальному продакшні, а не щось, що можна визначити наперед у MVP.

## 8. Secrets

Secret manager (напр. Doppler/Vault/cloud-native рішення), ніяких секретів у git. Ротація ключів (JWT signing key, S3 credentials) — процедура задокументована в `/docs/security.md`.

**Поточний стан (self-hosted MVP-деплой, до появи secret manager)**: `.env.production`
(з шаблону `.env.production.example`) — сам файл у `.gitignore`, у git лише
placeholder-значення (`change_me`). Секрети живуть на хості деплою, не в репозиторії.
Це усвідомлено проміжне рішення, не заміна secret manager — при появі реальної
production-інфраструктури `.env.production` варто замінити на injection із
Vault/Doppler/cloud secret store, без змін у коді (усе й так читається через
`process.env`/`ConfigService`).
