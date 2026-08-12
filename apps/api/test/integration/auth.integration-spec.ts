import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, requestOtpAndCaptureCode, resetDb } from './test-app';
import { uniquePhone } from './fixtures';

describe('Auth (OTP) integration', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    ({ app, dataSource } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb(dataSource);
  });

  it('request → verify видає реальні access/refresh токени, створює юзера', async () => {
    const phone = uniquePhone();
    const code = await requestOtpAndCaptureCode(
      (p) => request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone: p }),
      phone,
    );

    const res = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ phone, code });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ phone, role: 'user' });
  });

  it('невірний код відхиляється OTP_INVALID, не видає токенів', async () => {
    const phone = uniquePhone();
    await requestOtpAndCaptureCode(
      (p) => request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone: p }),
      phone,
    );

    const res = await request(app.getHttpServer()).post('/api/v1/auth/otp/verify').send({ phone, code: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('OTP_INVALID');
  });

  it('4-й otp/request для того самого номера за 15хв → 429 (rate limit справді enforced)', async () => {
    const phone = uniquePhone();

    for (let i = 0; i < 3; i += 1) {
      const res = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
      expect(res.status).toBe(201);
    }

    const fourth = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone });
    expect(fourth.status).toBe(429);
  });

  it('otp/request для РІЗНИХ номерів не ділить один ліміт (тракер за phone, не IP)', async () => {
    const phoneA = uniquePhone();
    const phoneB = uniquePhone();

    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone: phoneA }).expect(201);
    }

    const res = await request(app.getHttpServer()).post('/api/v1/auth/otp/request').send({ phone: phoneB });
    expect(res.status).toBe(201);
  });
});
