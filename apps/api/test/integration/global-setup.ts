import 'reflect-metadata';
import { Client } from 'pg';
import { DataSource } from 'typeorm';

const TEST_DB_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://vzhyk:vzhyk_dev_password@localhost:5432/vzhyk_test';

function parseDbName(url: string): string {
  return new URL(url).pathname.replace(/^\//, '');
}

function maintenanceUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = '/postgres';
  return parsed.toString();
}

/**
 * Jest globalSetup — окрема тестова БД `vzhyk_test` (не чіпає demo-дані в `vzhyk`),
 * мігрується наново перед кожним запуском test:integration. Той самий migrations glob,
 * що й `npm run migration:run` (src/database/data-source.ts), без залежності від
 * поточного стану дев-БД.
 */
export default async function globalSetup(): Promise<void> {
  const dbName = parseDbName(TEST_DB_URL);

  const admin = new Client({ connectionString: maintenanceUrl(TEST_DB_URL) });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${dbName}"`);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('already exists')) {
      throw err;
    }
  } finally {
    await admin.end();
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: TEST_DB_URL,
    migrations: [__dirname + '/../../src/database/migrations/*.{ts,js}'],
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.runMigrations();
  await dataSource.destroy();
}
