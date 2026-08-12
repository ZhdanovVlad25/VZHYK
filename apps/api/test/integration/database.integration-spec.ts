import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerPrivilegedUser, seedLeafCategory } from './fixtures';

/**
 * docs/testing.md §2 Database — міграції застосовуються чисто (перевіряється неявно:
 * globalSetup провалив би весь прогін, якби migrations впали) + реальний DB constraint.
 */
describe('Database integration', () => {
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

  it('unique(parentId, slug) constraint — дублікат slug на тому ж рівні відхиляється', async () => {
    const parent = await seedLeafCategory(dataSource, { slug: 'parent-cat', level: 0 });
    await seedLeafCategory(dataSource, { slug: 'dup-slug', parentId: parent.id, level: 1 });
    const admin = await registerPrivilegedUser(app, dataSource, 'admin');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ nameUk: 'X', slug: 'dup-slug', parentId: parent.id });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATEGORY_SLUG_TAKEN');
  });

  it('дозволяє однаковий slug на РІЗНИХ рівнях дерева (unique лише в межах parentId)', async () => {
    const parentA = await seedLeafCategory(dataSource, { slug: 'parent-a', level: 0 });
    const parentB = await seedLeafCategory(dataSource, { slug: 'parent-b', level: 0 });
    await seedLeafCategory(dataSource, { slug: 'shared-slug', parentId: parentA.id, level: 1 });
    const admin = await registerPrivilegedUser(app, dataSource, 'admin');

    const res = await request(app.getHttpServer())
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ nameUk: 'Y', slug: 'shared-slug', parentId: parentB.id });

    expect(res.status).toBe(201);
  });
});
