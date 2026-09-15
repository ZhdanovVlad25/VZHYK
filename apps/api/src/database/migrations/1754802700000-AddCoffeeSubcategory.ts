import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Кава" — окрема підкатегорія в "Дім і сад" (сусідня з "Продукти харчування / напої"),
 * а не її дитина: форма створення оголошення (apps/web/src/app/listings/new/page.tsx)
 * читає лише два рівні — topCategory.children — і не спускається до level 2, тож
 * будь-яка підкатегорія, розрахована на вибір у формі, має бути рівня 1.
 */
const PARENT_NAME = 'Дім і сад';
const NAME_UK = 'Кава';
const SLUG = 'kava';
/** Одразу після "Продукти харчування / напої" (sortOrder=2 у AddCategorySubcategories). */
const SORT_ORDER = 3;

export class AddCoffeeSubcategory1754802700000 implements MigrationInterface {
  name = 'AddCoffeeSubcategory1754802700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "categories" SET "sortOrder" = "sortOrder" + 1
        WHERE "parentId" = (SELECT "id" FROM "categories" WHERE "nameUk" = $1 AND "parentId" IS NULL)
          AND "sortOrder" >= $2
      `,
      [PARENT_NAME, SORT_ORDER],
    );

    await queryRunner.query(
      `
        INSERT INTO "categories" ("parentId", "nameUk", "slug", "sortOrder", "level")
        SELECT "id", $1, $2, $3, 1 FROM "categories" WHERE "nameUk" = $4 AND "parentId" IS NULL
        ON CONFLICT DO NOTHING
      `,
      [NAME_UK, SLUG, SORT_ORDER, PARENT_NAME],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        DELETE FROM "categories"
        WHERE "slug" = $1
          AND "parentId" IN (SELECT "id" FROM "categories" WHERE "nameUk" = $2 AND "parentId" IS NULL)
      `,
      [SLUG, PARENT_NAME],
    );

    await queryRunner.query(
      `
        UPDATE "categories" SET "sortOrder" = "sortOrder" - 1
        WHERE "parentId" = (SELECT "id" FROM "categories" WHERE "nameUk" = $1 AND "parentId" IS NULL)
          AND "sortOrder" > $2
      `,
      [PARENT_NAME, SORT_ORDER],
    );
  }
}
