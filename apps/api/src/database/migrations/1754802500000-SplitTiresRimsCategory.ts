import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Шини, диски і колеса" була однією підкатегорією в "Запчастини" — заміняємо трьома
 * точнішими: Шини / Диски / Колеса в зборі. Стару категорію не видаляємо (є FK з
 * listings.categoryId) — деактивуємо, щоб зникла з форми створення/пошуку, але лишається
 * валідною для вже існуючих оголошень, які не вдалось однозначно перенести автоматично.
 */
const NEW_SUBCATEGORIES = [
  { nameUk: 'Шини', slug: 'shyny' },
  { nameUk: 'Диски', slug: 'dysky' },
  { nameUk: 'Колеса в зборі', slug: 'kolesa-v-zbori' },
];

const OLD_SLUG = 'shyny-dysky-i-kolesa';
const PARENT_NAME = 'Запчастини';

export class SplitTiresRimsCategory1754802500000 implements MigrationInterface {
  name = 'SplitTiresRimsCategory1754802500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (let i = 0; i < NEW_SUBCATEGORIES.length; i++) {
      const { nameUk, slug } = NEW_SUBCATEGORIES[i];
      await queryRunner.query(
        `
          INSERT INTO "categories" ("parentId", "nameUk", "slug", "sortOrder", "level")
          SELECT "id", $1, $2, $3, 1 FROM "categories" WHERE "nameUk" = $4 AND "parentId" IS NULL
          ON CONFLICT DO NOTHING
        `,
        [nameUk, slug, i, PARENT_NAME],
      );
    }

    // Єдине існуюче оголошення в старій категорії на момент міграції — "Гума 215 65 r17" —
    // однозначно шина, тож переносимо автоматично. Будь-які інші оголошення (якщо з'являться
    // між написанням і запуском цієї міграції) лишаються в деактивованій старій категорії —
    // видимі лише власнику/по прямому лінку, потребують ручного перенесення адміном.
    await queryRunner.query(
      `
        UPDATE "listings"
        SET "categoryId" = (SELECT "id" FROM "categories" WHERE "slug" = 'shyny' AND "parentId" = (
          SELECT "id" FROM "categories" WHERE "nameUk" = $1 AND "parentId" IS NULL
        ))
        WHERE "categoryId" = (SELECT "id" FROM "categories" WHERE "slug" = $2)
          AND "title" ILIKE '%гума%'
      `,
      [PARENT_NAME, OLD_SLUG],
    );

    await queryRunner.query(`UPDATE "categories" SET "isActive" = false WHERE "slug" = $1`, [OLD_SLUG]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "categories" SET "isActive" = true WHERE "slug" = $1`, [OLD_SLUG]);
    const slugs = NEW_SUBCATEGORIES.map((s) => s.slug);
    await queryRunner.query(
      `
        DELETE FROM "categories"
        WHERE "slug" = ANY($1)
          AND "parentId" IN (SELECT "id" FROM "categories" WHERE "nameUk" = $2 AND "parentId" IS NULL)
      `,
      [slugs, PARENT_NAME],
    );
  }
}
