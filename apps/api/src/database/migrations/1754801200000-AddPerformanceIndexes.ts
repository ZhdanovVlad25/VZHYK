import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6 — Performance audit: два індекси, яких бракувало для гарячих шляхів.
 * "listings"."price" — сортування price_asc/price_desc у SearchProvider (keyset-порівняння
 * по price, apps/api/src/providers/search/postgres-fts-search.provider.ts) досі йшло без
 * індексу. "media"(listingId, isMain) — той самий провайдер робить корельований підзапит
 * "WHERE listingId = ... AND isMain = true" на кожен рядок видачі; існуючий idx_media_listing
 * покриває лише listingId, isMain фільтрується вже після сканування.
 */
export class AddPerformanceIndexes1754801200000 implements MigrationInterface {
  name = 'AddPerformanceIndexes1754801200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX "idx_listings_price" ON "listings" ("price");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_media_listing_is_main" ON "media" ("listingId", "isMain");`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_media_listing_is_main";`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listings_price";`);
  }
}
