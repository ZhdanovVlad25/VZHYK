import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Постгрес без словника для української (searchVector, 1754800300000, 'simple' config —
 * без стемінгу) не знаходить "квартиру" за запитом "квартира", ні "кросівки" за префіксом
 * "кросівк" — websearch_to_tsquery шукає точний токен. pg_trgm рахує схожість підрядків
 * (триграм), тому "квартира"/"квартиру" (спільні майже всі триграми, крім останньої)
 * і "кросівк"/"кросівки" (префікс) обидва проходять достатній поріг схожості — без
 * потреби у справжньому лінгвістичному словнику. PostgresFtsSearchProvider.search()
 * тепер шукає title І через tsvector (як раніше), І через similarity() — object OR.
 */
export class AddTrigramSearchOnListingsTitle1754802200000 implements MigrationInterface {
  name = 'AddTrigramSearchOnListingsTitle1754802200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE INDEX "idx_listings_title_trgm" ON "listings" USING GIN ("title" gin_trgm_ops)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_listings_title_trgm"`);
    // pg_trgm лишаємо — могла використовуватись деінде до цієї міграції, DROP EXTENSION зайвий ризик.
  }
}
