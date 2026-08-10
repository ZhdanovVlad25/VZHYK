# ВЖИК — Deployment

## 1. Середовища

`local (docker-compose)` → `staging` → `production`. Окремі БД, secrets, S3-buckets для кожного середовища; ніколи не використовувати production-дані в staging без анонімізації.

## 2. Локальна розробка

`docker-compose.yml`: `postgres`, `redis`, `minio` (S3-сумісне сховище), `api` (NestJS, hot reload), `web` (Next.js dev server). Один `make up` / `docker compose up` піднімає повне середовище + `seed` job.

## 3. Контейнеризація

Multi-stage Dockerfile для `api` та `web` (build stage → slim runtime image). Образи публікуються в container registry з тегом = git SHA.

## 4. CI/CD (мінімум для MVP)

1. **CI** (на кожен PR): lint, typecheck, unit tests, build.
2. **CI** (на merge в main): integration tests, build & push images.
3. **CD**: ручний/автоматичний деплой на staging → smoke tests → ручне підтвердження → деплой на production.

Міграції БД виконуються як окремий crop-степ перед розкатуванням нової версії `api` (backward-compatible міграції: спочатку additive-зміни, видалення колонок — окремим релізом пізніше).

## 5. Infrastructure (production, орієнтовно)

- Managed PostgreSQL (з read replica за потреби на Phase 6+).
- Managed Redis.
- Object storage (AWS S3 або сумісний, з CDN перед ним для медіа).
- API за load balancer, кілька реплік `api` (stateless, окрім WS-з'єднань — sticky sessions або Redis adapter для Socket.IO).
- CDN для статики Next.js та зображень.

## 6. Моніторинг та логування (Phase 8)

Структуровані JSON-логи → централізований collector. Метрики (latency, error rate, queue depth) → Prometheus/Grafana або managed аналог. Error tracking (Sentry) для frontend і backend. Alerting на критичні пороги (5xx rate, черга модерації, queue backlog).

## 7. Backup & Disaster Recovery

Щоденні автоматичні backup БД (point-in-time recovery), реплікація object storage, задокументована процедура відновлення (RTO/RPO — визначити на Phase 8 разом з бізнесом).

## 8. Secrets

Secret manager (напр. Doppler/Vault/cloud-native рішення), ніяких секретів у git. Ротація ключів (JWT signing key, S3 credentials) — процедура задокументована в `/docs/security.md`.
