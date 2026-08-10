import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3 — Favorites. docs/database.md §2, docs/api.md §8. */
export class AddFavorites1754800400000 implements MigrationInterface {
  name = 'AddFavorites1754800400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "favorites" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "listingId" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
        "priceSnapshot" numeric(12,2),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX "idx_favorites_user_listing" ON "favorites" ("userId", "listingId");
      CREATE INDEX "idx_favorites_listing" ON "favorites" ("listingId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "favorites";`);
  }
}
