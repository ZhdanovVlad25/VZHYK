import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerPrivilegedUser, registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

describe('Moderation integration', () => {
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

  it('заборонене слово в title → NEEDS_REVIEW, listing лишається PENDING_MODERATION', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Продам зброя мисливська'), price: 1000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/listings/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(201);

    const queue = await request(app.getHttpServer())
      .get('/api/v1/admin/moderation/queue?status=NEEDS_REVIEW')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);

    const moderationCase = queue.body.find((c: { listingId: string }) => c.listingId === created.body.id);
    expect(moderationCase).toBeDefined();
    expect(moderationCase.autoFlagReason).toContain('BANNED_WORD');

    // Анонімно PENDING_MODERATION не видно (findVisible ховає непублічні статуси як 404) —
    // перевіряємо як власник.
    const listing = await request(app.getHttpServer())
      .get(`/api/v1/listings/${created.body.id}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(200);
    expect(listing.body.status).toBe('PENDING_MODERATION');
  });

  it('повторне decide() на вже вирішеній справі — MODERATION_CASE_ALREADY_DECIDED', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Чиста назва'), price: 1000 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/listings/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(201);

    const queue = await request(app.getHttpServer())
      .get('/api/v1/admin/moderation/queue?status=PENDING')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);
    const moderationCase = queue.body.find((c: { listingId: string }) => c.listingId === created.body.id);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/moderation/${moderationCase.id}/decide`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ decision: 'APPROVED' })
      .expect(201);

    const secondDecision = await request(app.getHttpServer())
      .post(`/api/v1/admin/moderation/${moderationCase.id}/decide`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ decision: 'REJECTED' });

    expect(secondDecision.status).toBe(400);
    expect(secondDecision.body.error.code).toBe('MODERATION_CASE_ALREADY_DECIDED');
  });
});
