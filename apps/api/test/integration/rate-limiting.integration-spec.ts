import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

/**
 * docs/security.md §6 per-user ліміти — RateLimitService (Redis INCR+EXPIRE в сервісному
 * шарі, не ThrottlerGuard, див. roadmap.md grabli #11 чому). N+1-й виклик у вікні → 429.
 */
describe('Rate limiting (per-user) integration', () => {
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

  it('/listings create — 21-е оголошення за добу від того самого юзера → 429', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());

    for (let i = 0; i < 20; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/listings')
        .set('Authorization', `Bearer ${seller.accessToken}`)
        .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle(`Товар ${i}`), price: 100 });
      expect(res.status).toBe(201);
    }

    const res21 = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Товар 21'), price: 100 });

    expect(res21.status).toBe(429);
    expect(res21.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  }, 30_000);

  it('/chats/:id/messages — 61-е повідомлення за хвилину від того самого юзера → 429', async () => {
    const alice = await registerUser(app.getHttpServer());
    const bob = await registerUser(app.getHttpServer());
    const chat = await request(app.getHttpServer())
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ otherUserId: bob.userId })
      .expect(201);

    for (let i = 0; i < 60; i += 1) {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/chats/${chat.body.id}/messages`)
        .set('Authorization', `Bearer ${alice.accessToken}`)
        .send({ text: `Повідомлення ${i}` });
      expect(res.status).toBe(201);
    }

    const res61 = await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ text: 'Повідомлення 61' });

    expect(res61.status).toBe(429);
    expect(res61.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  }, 30_000);

  it('/reports — 11-та скарга за добу від того самого юзера → 429', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const reporter = await registerUser(app.getHttpServer());

    const listing = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Товар для скарг'), price: 100 })
      .expect(201);

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app.getHttpServer())
        .post('/api/v1/reports')
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .send({ targetType: 'LISTING', targetId: listing.body.id, reason: 'SPAM' });
      expect(res.status).toBe(201);
    }

    const res11 = await request(app.getHttpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ targetType: 'LISTING', targetId: listing.body.id, reason: 'SPAM' });

    expect(res11.status).toBe(429);
    expect(res11.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  }, 30_000);
});
