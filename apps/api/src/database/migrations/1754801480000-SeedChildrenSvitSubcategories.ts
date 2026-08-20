import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Дитячий світ" — підкатегорії, як і топ-рівневі категорії (SeedTopLevelCategories),
 * ніколи не потрапляли в жодну міграцію: були заведені вручну на dev-базі задовго до
 * AddCategorySubcategories (яка навмисно пропускає "Дитячий світ", вважаючи його вже
 * заповненим — вірно для dev, невірно для чистої prod-бази). Значення й порядок узяті
 * 1:1 з дерева категорій, що вже працює в dev.
 */
const CHILDREN_SUBCATEGORIES: { nameUk: string; slug: string }[] = [
  { nameUk: 'Дитячий одяг', slug: 'dytiachyi-odiah' },
  { nameUk: 'Дитяче взуття', slug: 'dytiache-vzuttia' },
  { nameUk: 'Дитячі коляски', slug: 'dytiachi-koliasky' },
  { nameUk: 'Дитячі автокрісла', slug: 'dytiachi-avtokrisla' },
  { nameUk: 'Дитячі меблі', slug: 'dytiachi-mebli' },
  { nameUk: 'Іграшки', slug: 'ihrashky' },
  { nameUk: 'Дитячий транспорт', slug: 'dytiachyi-transport' },
  { nameUk: 'Годування', slug: 'hoduvannia' },
  { nameUk: 'Товари для школярів', slug: 'tovary-dlia-shkoliariv' },
  { nameUk: 'Інші дитячі товари', slug: 'inshi-dytiachi-tovary' },
];

export class SeedChildrenSvitSubcategories1754801480000 implements MigrationInterface {
  name = 'SeedChildrenSvitSubcategories1754801480000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (let i = 0; i < CHILDREN_SUBCATEGORIES.length; i++) {
      const { nameUk, slug } = CHILDREN_SUBCATEGORIES[i];
      await queryRunner.query(
        `
          INSERT INTO "categories" ("parentId", "nameUk", "slug", "sortOrder", "level")
          SELECT "id", $1, $2, $3, 1 FROM "categories" WHERE "nameUk" = 'Дитячий світ' AND "parentId" IS NULL
          ON CONFLICT DO NOTHING
        `,
        [nameUk, slug, i],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const slugs = CHILDREN_SUBCATEGORIES.map((s) => s.slug);
    await queryRunner.query(
      `
        DELETE FROM "categories"
        WHERE "slug" = ANY($1)
          AND "parentId" IN (SELECT "id" FROM "categories" WHERE "nameUk" = 'Дитячий світ' AND "parentId" IS NULL)
      `,
      [slugs],
    );
  }
}
