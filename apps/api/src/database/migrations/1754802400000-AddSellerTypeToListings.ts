import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSellerTypeToListings1754802400000 implements MigrationInterface {
  name = 'AddSellerTypeToListings1754802400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "listing_seller_type_enum" AS ENUM ('private', 'business')`);
    // DEFAULT 'private' на NOT NULL колонці бекафілить усі існуючі рядки одразу — за задумом:
    // оголошення, створені до цього поля, лишаються приватними.
    await queryRunner.query(
      `ALTER TABLE "listings" ADD COLUMN "sellerType" listing_seller_type_enum NOT NULL DEFAULT 'private'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN "sellerType"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "listing_seller_type_enum"`);
  }
}
