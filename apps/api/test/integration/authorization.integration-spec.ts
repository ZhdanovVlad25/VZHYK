import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerUser, seedLeafCategory, uniqueTitle } from './fixtures';

/**
 * docs/testing.md §4 "тести на... authorization (заборонені переходи ролей/ownership)".
 * Наскрізні adversarial-кейси, окремі від feature-специфічних сюїтів.
 */
describe('Authorization integration', () => {
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

  it('неавтентифікований запит до захищеного маршруту → 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('звичайний user на /admin/dashboard → 403', async () => {
    const user = await registerUser(app.getHttpServer());

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('звичайний user на /admin/moderation/queue → 403', async () => {
    const user = await registerUser(app.getHttpServer());

    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/moderation/queue')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(403);
  });

  it('user B не може відредагувати оголошення, яким володіє user A → 403 LISTING_NOT_OWNER', async () => {
    const category = await seedLeafCategory(dataSource);
    const ownerA = await registerUser(app.getHttpServer());
    const userB = await registerUser(app.getHttpServer());

    const listing = await request(app.getHttpServer())
      .post('/api/v1/listings')
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ categoryId: category.id, listingType: 'sell', title: uniqueTitle('Чуже оголошення'), price: 100 })
      .expect(201);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/listings/${listing.body.id}`)
      .set('Authorization', `Bearer ${userB.accessToken}`)
      .send({ title: uniqueTitle('Спроба чужого редагування') });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('LISTING_NOT_OWNER');
  });

  it('не-учасник чату не бачить його повідомлень — 404, не 403 (existence-hiding)', async () => {
    const alice = await registerUser(app.getHttpServer());
    const bob = await registerUser(app.getHttpServer());
    const outsider = await registerUser(app.getHttpServer());

    const chat = await request(app.getHttpServer())
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ otherUserId: bob.userId })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/chats/${chat.body.id}/messages`)
      .set('Authorization', `Bearer ${outsider.accessToken}`);

    expect(res.status).toBe(404);
  });
});
