import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoRenewToListings1754802000000 implements MigrationInterface {
  name = 'AddAutoRenewToListings1754802000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "autoRenew" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "autoRenew"`);
  }
}
