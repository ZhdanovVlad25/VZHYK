import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Приймати дзвінки" — перемикач у профілі: якщо вимкнено, номер телефону не показується
 * покупцям взагалі (навіть автентифікованим), лишається лише чат. Дефолт true — не змінює
 * поведінку для існуючих юзерів.
 */
export class AddAcceptsCallsToProfiles1754801900000 implements MigrationInterface {
  name = 'AddAcceptsCallsToProfiles1754801900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "profiles" ADD COLUMN "acceptsCalls" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "profiles" DROP COLUMN "acceptsCalls"`);
  }
}
