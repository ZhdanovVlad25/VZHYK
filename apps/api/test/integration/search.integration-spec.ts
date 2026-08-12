import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerPrivilegedUser, registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

async function createActiveListing(
  app: INestApplication,
  sellerToken: string,
  moderatorToken: string,
  categoryId: string,
  overrides: { title: string; price: number },
): Promise<string> {
  const created = await request(app.getHttpServer())
    .post('/api/v1/listings')
    .set('Authorization', `Bearer ${sellerToken}`)
    .send({ categoryId, listingType: 'sell', ...overrides })
    .expect(201);

  await request(app.getHttpServer())
    .post(`/api/v1/listings/${created.body.id}/publish`)
    .set('Authorization', `Bearer ${sellerToken}`)
    .expect(201);

  const queue = await request(app.getHttpServer())
    .get('/api/v1/admin/moderation/queue?status=PENDING')
    .set('Authorization', `Bearer ${moderatorToken}`)
    .expect(200);
  const moderationCase = queue.body.find((c: { listingId: string }) => c.listingId === created.body.id);

  await request(app.getHttpServer())
    .post(`/api/v1/admin/moderation/${moderationCase.id}/decide`)
    .set('Authorization', `Bearer ${moderatorToken}`)
    .send({ decision: 'APPROVED' })
    .expect(201);

  return created.body.id;
}

describe('Search integration', () => {
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

  it('фільтр за category + priceMin/priceMax повертає лише відповідні ACTIVE оголошення', async () => {
    const categoryA = await seedLeafCategory(dataSource, { slug: 'cat-a' });
    const categoryB = await seedLeafCategory(dataSource, { slug: 'cat-b' });
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');

    const inRange = await createActiveListing(app, seller.accessToken, moderator.accessToken, categoryA.id, {
      title: uniqueTitle('Велосипед гірський'),
      price: 5000,
    });
    await createActiveListing(app, seller.accessToken, moderator.accessToken, categoryA.id, {
      title: uniqueTitle('Велосипед дорогий'),
      price: 50000,
    });
    await createActiveListing(app, seller.accessToken, moderator.accessToken, categoryB.id, {
      title: uniqueTitle('Інша категорія'),
      price: 5000,
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/search?category=${categoryA.id}&priceMin=1000&priceMax=10000`)
      .expect(200);

    expect(res.body.items.map((i: { id: string }) => i.id)).toEqual([inRange]);
  });

  it('cursor-пагінація з limit=1 повертає різні елементи без дублікатів/пропусків', async () => {
    const category = await seedLeafCategory(dataSource);
    const seller = await registerUser(app.getHttpServer());
    const moderator = await registerPrivilegedUser(app, dataSource, 'moderator');

    const first = await createActiveListing(app, seller.accessToken, moderator.accessToken, category.id, {
      title: uniqueTitle('Товар А'),
      price: 100,
    });
    const second = await createActiveListing(app, seller.accessToken, moderator.accessToken, category.id, {
      title: uniqueTitle('Товар Б'),
      price: 200,
    });

    const page1 = await request(app.getHttpServer())
      .get(`/api/v1/search?category=${category.id}&sort=newest&limit=1`)
      .expect(200);
    expect(page1.body.items).toHaveLength(1);
    expect(page1.body.nextCursor).not.toBeNull();

    const page2 = await request(app.getHttpServer())
      .get(`/api/v1/search?category=${category.id}&sort=newest&limit=1&cursor=${encodeURIComponent(page1.body.nextCursor)}`)
      .expect(200);
    expect(page2.body.items).toHaveLength(1);

    const seenIds = [page1.body.items[0].id, page2.body.items[0].id];
    expect(new Set(seenIds).size).toBe(2);
    expect(seenIds.sort()).toEqual([first, second].sort());
  });
});
