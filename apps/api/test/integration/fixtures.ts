import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Category } from '../../src/modules/categories/category.entity';
import { User, UserRole } from '../../src/modules/users/user.entity';
import { requestOtpAndCaptureCode, signTestToken } from './test-app';

const PHONE_PREFIXES = ['67', '68', '96', '97', '98', '50', '66', '95', '99'];

/** `@IsPhoneNumber('UA')` валідує через libphonenumber-js — потрібні реальні мобільні префікси. */
export function uniquePhone(): string {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const suffix = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
  return `+380${prefix}${suffix}`;
}

export function uniqueTitle(base: string): string {
  return `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export async function seedLeafCategory(dataSource: DataSource, overrides: Partial<Category> = {}): Promise<Category> {
  const repo = dataSource.getRepository(Category);
  return repo.save(
    repo.create({
      nameUk: 'Тестова категорія',
      slug: `test-cat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      parentId: null,
      level: 0,
      sortOrder: 0,
      isActive: true,
      ...overrides,
    }),
  );
}

export async function promoteRole(dataSource: DataSource, userId: string, role: UserRole): Promise<void> {
  await dataSource.getRepository(User).update({ id: userId }, { role });
}

export interface RegisteredUser {
  userId: string;
  accessToken: string;
  phone: string;
}

/** Повний OTP-флоу (request → console.log capture → verify) проти реального httpServer. */
export async function registerUser(httpServer: unknown, phone: string = uniquePhone()): Promise<RegisteredUser> {
  const code = await requestOtpAndCaptureCode(
    (p) => request(httpServer as never).post('/api/v1/auth/otp/request').send({ phone: p }),
    phone,
  );
  const res = await request(httpServer as never).post('/api/v1/auth/otp/verify').send({ phone, code }).expect(201);
  return { userId: res.body.user.id, accessToken: res.body.accessToken, phone };
}

/**
 * Реєструє юзера через реальний OTP-флоу, тоді промоутить роль напряму в БД і підписує
 * СВІЖИЙ токен через signTestToken() (не через повторний otp/verify — уникає зайвого
 * витрачання OTP-бюджету 3/15хв на номер, roadmap.md grabli #10 про role-в-payload).
 */
export async function registerPrivilegedUser(
  app: INestApplication,
  dataSource: DataSource,
  role: UserRole,
): Promise<RegisteredUser> {
  const user = await registerUser(app.getHttpServer());
  await promoteRole(dataSource, user.userId, role);
  const accessToken = signTestToken(app, { sub: user.userId, role, phone: user.phone });
  return { ...user, accessToken };
}
