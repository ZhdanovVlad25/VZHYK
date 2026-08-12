import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerPrivilegedUser, registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

/**
 * docs/testing.md §2 Listings — create → publish → moderation → active. `publish()`
 * НЕ авто-схвалює (Phase 4, roadmap.md) — навіть без banned words listing лишається
 * PENDING_MODERATION, доки ModerationService.decide(APPROVED) не переведе в ACTIVE.
 */
describe('Listings integration', () => {
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

  it('create → publish → decide(APPROVED) → ACTIVE', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Ноутбук Dell'), price: 15000 })
      .expect(201);

    expect(created.body.status).toBe('DRAFT');

    const published = await request(app.getHttpServer())
      .post(`/api/v1/listings/${created.body.id}/publish`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(201);

    expect(published.body.status).toBe('PENDING_MODERATION');

    const queue = await request(app.getHttpServer())
      .get('/api/v1/admin/moderation/queue?status=PENDING')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);
    const moderationCase = queue.body.find((c: { listingId: string }) => c.listingId === created.body.id);
    expect(moderationCase).toBeDefined();
    expect(moderationCase.autoFlagReason).toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/admin/moderation/${moderationCase.id}/decide`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ decision: 'APPROVED' })
      .expect(201);

    const final = await request(app.getHttpServer()).get(`/api/v1/listings/${created.body.id}`).expect(200);
    expect(final.body.status).toBe('ACTIVE');
    expect(final.body.publishedAt).not.toBeNull();
  });

  it('archive() з DRAFT — недопустимий перехід', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Диван'), price: 3000 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/listings/${created.body.id}/archive`)
      .set('Authorization', `Bearer ${seller.accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('LISTING_INVALID_TRANSITION');
  });
});
