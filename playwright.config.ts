import { defineConfig, devices } from '@playwright/test';

/**
 * docs/testing.md §3 E2E. Жодного `webServer` auto-start — api/web мають вже працювати
 * як окремі процеси (roadmap.md "Швидкий старт": на Windows паралельний запуск через
 * корене вий `npm run dev` ламається через `&`). Прогін проти того самого dev-стеку
 * (docker compose + npm run dev), що використовується для ручного тестування — не
 * окрема E2E-БД (staging не існує, Phase 8 не розпочато), ізоляція — через випадкові
 * телефони на кожен сценарій (e2e/helpers/fixtures.ts).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
