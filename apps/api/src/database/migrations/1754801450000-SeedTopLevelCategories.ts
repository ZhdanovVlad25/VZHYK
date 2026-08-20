import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Топ-рівневі категорії (level 0) ніколи не потрапляли в жодну міграцію — на dev-базі
 * вони колись були заведені вручну через apps/api/src/database/seeds/run-seed.ts
 * (запускався локально, не в рамках migration:run), тож нова/чиста база (напр. prod на
 * Railway) лишається без жодної категорії. Ця міграція — той самий список і той самий
 * slugify, що й у run-seed.ts, але лише категорії (locations вже покриті окремою
 * міграцією SeedOblastsAndCities) і ідемпотентно (ON CONFLICT DO NOTHING по slug).
 */
const TOP_LEVEL_CATEGORIES = [
  'Дитячий світ',
  'Нерухомість',
  'Авто',
  'Запчастини',
  'Електроніка',
  'Дім і сад',
  'Мода і стиль',
  'Хобі, відпочинок і спорт',
  'Робота',
  'Бізнес та послуги',
  'Тварини',
  'Оренда та прокат',
  'Житло подобово',
  'Безкоштовно',
  'Обмін',
];

function slugify(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh',
    з: 'z', и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n',
    о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts',
    ч: 'ch', ш: 'sh', щ: 'shch', ь: '', ю: 'iu', я: 'ia', ' ': '-', ',': '',
  };
  return input
    .toLowerCase()
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export class SeedTopLevelCategories1754801450000 implements MigrationInterface {
  name = 'SeedTopLevelCategories1754801450000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (let i = 0; i < TOP_LEVEL_CATEGORIES.length; i++) {
      const nameUk = TOP_LEVEL_CATEGORIES[i];
      await queryRunner.query(
        `
          INSERT INTO "categories" ("nameUk", "slug", "level", "sortOrder", "isActive")
          VALUES ($1, $2, 0, $3, true)
          ON CONFLICT DO NOTHING
        `,
        [nameUk, slugify(nameUk), i],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const slugs = TOP_LEVEL_CATEGORIES.map(slugify);
    await queryRunner.query(
      `DELETE FROM "categories" WHERE "slug" = ANY($1) AND "parentId" IS NULL`,
      [slugs],
    );
  }
}
