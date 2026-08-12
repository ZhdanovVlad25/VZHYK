/**
 * Jest `setupFiles` — виконується до імпорту AppModule будь-яким integration-spec.
 * dotenv у ConfigModule.forRoot() (app.module.ts) НЕ перезаписує вже встановлені
 * process.env змінні, тож достатньо виставити їх тут раніше.
 */
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://vzhyk:vzhyk_dev_password@localhost:5432/vzhyk_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6379/1';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? 'integration_test_access_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'integration_test_refresh_secret';
