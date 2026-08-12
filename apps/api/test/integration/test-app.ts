import 'reflect-metadata';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/shared/filters/all-exceptions.filter';
import { UserRole } from '../../src/modules/users/user.entity';

/** Той самий bootstrap, що main.ts, але для supertest (без .listen() на реальному порту). */
export async function createTestApp(): Promise<{ app: INestApplication; dataSource: DataSource }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();

  const dataSource = moduleRef.get(DataSource);
  return { app, dataSource };
}

/**
 * Підписує JWT напряму через JwtService застосунку (той самий секрет, що й реальний
 * логін) — уникає подвійного OTP-round-trip лише заради зміни ролі в payload
 * (roadmap.md grabli #10: role береться з payload, не з БД, тож потрібен новий токен
 * після промоушену). Не підмінює сам OTP-флоу — той перевіряється окремо в
 * auth.integration-spec.ts.
 */
export function signTestToken(app: INestApplication, payload: { sub: string; role: UserRole; phone: string | null }): string {
  const jwt = app.get(JwtService);
  return jwt.sign(payload, { expiresIn: '15m' });
}

/** Очищає всі таблиці застосунку (крім migrations) — кожна integration-suite сама сіє потрібні фікстури. */
export async function resetDb(dataSource: DataSource): Promise<void> {
  const tables: { tablename: string }[] = await dataSource.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != 'migrations'`,
  );
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(', ');
  await dataSource.query(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}

/**
 * OTP-код видається лише як `[otp] +380... -> 123456` через console.log (SMS_PROVIDER=console,
 * dev-заглушка — auth.service.ts). Integration-тести працюють в одному Node-процесі з app'ою,
 * тож перехоплюємо console.log замість підміни argon2-хешу в БД (той трюк — лише для
 * окремопроцесного Playwright E2E, див. e2e/helpers/auth.ts).
 */
export async function requestOtpAndCaptureCode(
  request: (phone: string) => Promise<unknown>,
  phone: string,
): Promise<string> {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    await request(phone);
    const call = spy.mock.calls.find((args) => typeof args[0] === 'string' && args[0].includes(`[otp] ${phone} ->`));
    if (!call) {
      throw new Error(`OTP code for ${phone} not found in console.log calls`);
    }
    const match = (call[0] as string).match(/-> (\d+)/);
    if (!match) {
      throw new Error(`Could not parse OTP code from log line: ${call[0]}`);
    }
    return match[1];
  } finally {
    spy.mockRestore();
  }
}
