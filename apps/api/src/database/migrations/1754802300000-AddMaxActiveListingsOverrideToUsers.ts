import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMaxActiveListingsOverrideToUsers1754802300000 implements MigrationInterface {
  name = 'AddMaxActiveListingsOverrideToUsers1754802300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "maxActiveListingsOverride" integer`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "maxActiveListingsOverride"`);
  }
}
