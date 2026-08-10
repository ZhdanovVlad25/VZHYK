import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 2 — Search: search_vector на listings, підтримується тригером (не додаток),
 * тому в Listing entity цієї колонки немає — доступ лише через raw SQL у SearchProvider.
 * 'simple' text search config — без стемінгу (немає вбудованого українського словника
 * в стандартній поставці Postgres); docs/architecture.md §4 PostgresFtsSearchProvider (MVP).
 */
export class AddListingsSearchVector1754800300000 implements MigrationInterface {
  name = 'AddListingsSearchVector1754800300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "listings" ADD COLUMN "searchVector" tsvector;`);

    await queryRunner.query(`
      CREATE FUNCTION listings_search_vector_update() RETURNS trigger AS $$
      BEGIN
        NEW."searchVector" :=
          setweight(to_tsvector('simple', coalesce(NEW."title", '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'B');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER listings_search_vector_trigger
        BEFORE INSERT OR UPDATE OF "title", "description" ON "listings"
        FOR EACH ROW EXECUTE FUNCTION listings_search_vector_update();
    `);

    await queryRunner.query(`CREATE INDEX "idx_listings_search_vector" ON "listings" USING GIN ("searchVector");`);

    // Бекфіл існуючих рядків (тригер спрацьовує лише на INSERT/UPDATE title/description).
    await queryRunner.query(`UPDATE "listings" SET "title" = "title";`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listings_search_vector";`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS listings_search_vector_trigger ON "listings";`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS listings_search_vector_update();`);
    await queryRunner.query(`ALTER TABLE "listings" DROP COLUMN IF EXISTS "searchVector";`);
  }
}
