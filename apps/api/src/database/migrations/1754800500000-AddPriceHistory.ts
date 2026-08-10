import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3 — Price history. docs/database.md §1 (append-only) §2. Реюзає listing_currency_enum. */
export class AddPriceHistory1754800500000 implements MigrationInterface {
  name = 'AddPriceHistory1754800500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "price_history" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "listingId" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
        "oldPrice" numeric(12,2),
        "newPrice" numeric(12,2),
        "currency" listing_currency_enum NOT NULL,
        "changedAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_price_history_listing" ON "price_history" ("listingId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "price_history";`);
  }
}
