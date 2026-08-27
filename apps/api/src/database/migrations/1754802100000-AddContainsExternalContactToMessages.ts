import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContainsExternalContactToMessages1754802100000 implements MigrationInterface {
  name = 'AddContainsExternalContactToMessages1754802100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "messages" ADD COLUMN "containsExternalContact" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "containsExternalContact"`);
  }
}
