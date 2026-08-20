import { MigrationInterface, QueryRunner } from 'typeorm';

/** Прев'ю останнього повідомлення в списку чатів — денормалізовано поряд із lastMessageAt (той самий патерн). */
export class AddChatLastMessageText1754801400000 implements MigrationInterface {
  name = 'AddChatLastMessageText1754801400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "chats" ADD COLUMN "lastMessageText" text;
    `);

    // Бекфіл для чатів, що вже мають повідомлення — текст останнього по createdAt.
    await queryRunner.query(`
      UPDATE "chats" c
      SET "lastMessageText" = m."text"
      FROM (
        SELECT DISTINCT ON ("chatId") "chatId", "text"
        FROM "messages"
        ORDER BY "chatId", "createdAt" DESC
      ) m
      WHERE c."id" = m."chatId";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chats" DROP COLUMN IF EXISTS "lastMessageText";`);
  }
}
