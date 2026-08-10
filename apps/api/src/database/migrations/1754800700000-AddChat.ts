import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3 — Realtime chat. docs/database.md §2, §4. */
export class AddChat1754800700000 implements MigrationInterface {
  name = 'AddChat1754800700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "chats" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" uuid REFERENCES "listings"("id") ON DELETE SET NULL,
        "lastMessageAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_participants" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chatId" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "unreadCount" int NOT NULL DEFAULT 0,
        "isBlockedByOther" boolean NOT NULL DEFAULT false,
        "lastReadAt" timestamptz
      );
      CREATE UNIQUE INDEX "idx_chat_participants_chat_user" ON "chat_participants" ("chatId", "userId");
      CREATE INDEX "idx_chat_participants_user" ON "chat_participants" ("userId");
    `);

    await queryRunner.query(`
      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "chatId" uuid NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE,
        "senderId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "text" text NOT NULL,
        "mediaIds" uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "readAt" timestamptz
      );
      CREATE INDEX "idx_messages_chat_created" ON "messages" ("chatId", "createdAt");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "messages";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_participants";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chats";`);
  }
}
