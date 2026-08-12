import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, resetDb } from './test-app';
import { registerUser } from './fixtures';

describe('Chat integration', () => {
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

  it('повідомлення доставляється, unreadCount отримувача збільшується', async () => {
    const alice = await registerUser(app.getHttpServer());
    const bob = await registerUser(app.getHttpServer());

    const chat = await request(app.getHttpServer())
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ otherUserId: bob.userId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.body.id}/messages`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ text: 'Привіт, ще продається?' })
      .expect(201);

    const bobChats = await request(app.getHttpServer())
      .get('/api/v1/chats')
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .expect(200);

    const bobChatEntry = bobChats.body.find((c: { chatId: string }) => c.chatId === chat.body.id);
    expect(bobChatEntry.unreadCount).toBe(1);
  });

  it('block() забороняє заблокованому учаснику надсилати нові повідомлення (CHAT_BLOCKED)', async () => {
    const alice = await registerUser(app.getHttpServer());
    const bob = await registerUser(app.getHttpServer());

    const chat = await request(app.getHttpServer())
      .post('/api/v1/chats')
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .send({ otherUserId: bob.userId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.body.id}/block`)
      .set('Authorization', `Bearer ${alice.accessToken}`)
      .expect(204);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/chats/${chat.body.id}/messages`)
      .set('Authorization', `Bearer ${bob.accessToken}`)
      .send({ text: 'Це повідомлення не має пройти' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CHAT_BLOCKED');
  });
});
