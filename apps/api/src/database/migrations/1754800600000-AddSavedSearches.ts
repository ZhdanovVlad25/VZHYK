import { MigrationInterface, QueryRunner } from 'typeorm';

/** Phase 3 — Saved searches. docs/database.md §2, docs/api.md §8. */
export class AddSavedSearches1754800600000 implements MigrationInterface {
  name = 'AddSavedSearches1754800600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "saved_searches" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "queryText" varchar(200),
        "categoryId" uuid REFERENCES "categories"("id") ON DELETE CASCADE,
        "filters" jsonb,
        "regionLocationId" uuid REFERENCES "locations"("id") ON DELETE CASCADE,
        "lastNotifiedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX "idx_saved_searches_user" ON "saved_searches" ("userId");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_searches";`);
  }
}
