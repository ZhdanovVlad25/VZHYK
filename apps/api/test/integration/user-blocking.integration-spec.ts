import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerPrivilegedUser, registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

/**
 * docs/moderation.md §7 — "усі активні оголошення заблокованого користувача переходять
 * у BLOCKED". Наскрізна перевірка Part A2 fix через реальний HTTP-стек, не лише
 * unit-мокований AdminUsersService.
 */
describe('User blocking cascade integration', () => {
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

  it('блокування юзера переводить його ACTIVE оголошення в BLOCKED', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');
    const admin = await registerPrivilegedUser(app, dataSource, 'admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Товар під блокування'), price: 500 })
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

    const beforeBlock = await request(app.getHttpServer()).get(`/api/v1/listings/${created.body.id}`).expect(200);
    expect(beforeBlock.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${seller.userId}/block`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${seller.userId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200);
    expect(detail.body.status).toBe('blocked');
    const blockedListing = detail.body.listings.find((l: { id: string }) => l.id === created.body.id);
    expect(blockedListing.status).toBe('BLOCKED');

    // Заблокований listing зникає з публічного пошуку (search.remove() викликається каскадом).
    const searchRes = await request(app.getHttpServer())
      .get(`/api/v1/search?category=${category.id}`)
      .expect(200);
    expect(searchRes.body.items.map((i: { id: string }) => i.id)).not.toContain(created.body.id);
  });

  it('unblock() НЕ відновлює раніше заблоковані каскадом оголошення', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');
    const admin = await registerPrivilegedUser(app, dataSource, 'admin');

    const created = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Товар для unblock'), price: 700 })
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

    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${seller.userId}/block`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/users/${seller.userId}/unblock`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(201);

    // Анонімно/публічно BLOCKED оголошення взагалі не видно (findVisible ховає його як 404) —
    // перевіряємо як власник (findVisible дозволяє own listing незалежно від статусу).
    const listing = await request(app.getHttpServer())
      .get(`/api/v1/listings/${created.body.id}`)
      .set('Authorization', `Bearer ${seller.accessToken}`)
      .expect(200);
    expect(listing.body.status).toBe('BLOCKED');
  });
});
