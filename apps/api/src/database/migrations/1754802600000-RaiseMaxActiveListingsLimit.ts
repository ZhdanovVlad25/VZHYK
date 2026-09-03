import { MigrationInterface, QueryRunner } from 'typeorm';

export class RaiseMaxActiveListingsLimit1754802600000 implements MigrationInterface {
  name = 'RaiseMaxActiveListingsLimit1754802600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "app_settings" SET "value" = '20', "updatedAt" = now() WHERE "key" = 'listing.max_active_per_user'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "app_settings" SET "value" = '5', "updatedAt" = now() WHERE "key" = 'listing.max_active_per_user'`,
    );
  }
}
