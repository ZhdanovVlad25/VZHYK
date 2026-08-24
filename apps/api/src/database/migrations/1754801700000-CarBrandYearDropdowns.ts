import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "Марка" і "Рік випуску" були вільним текстом/числом — користувачі вводили довільні
 * варіанти написання марки (BMW / бмв / Бмв), рік теж без підказки діапазону. Переводимо
 * обидва на dataType='enum' з фіксованим списком (той самий Dropdown, що вже використовує
 * "Коробка передач"/"Тип палива" — apps/web AttributeFields.tsx).
 *
 * Список марок — ті, що реально трапляються на вторинному ринку України (бюджетні
 * корейські/китайські бренди включно), не лише європейські/японські. Рік — низхідний
 * список від наступного модельного року до 1970-го, найновіші зверху зручніше для авто.
 *
 * "Модель" свідомо лишається вільним текстом — повний каскадний список моделей на кожну
 * марку (тисячі записів) поза обсягом цього фіксу.
 */
const CAR_BRANDS = [
  'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'BYD', 'Buick', 'Cadillac', 'Chery', 'Chevrolet',
  'Chrysler', 'Citroen', 'Dacia', 'Daewoo', 'Daihatsu', 'Dodge', 'DongFeng', 'Fiat', 'Ford',
  'GMC', 'Geely', 'Genesis', 'Great Wall', 'Haval', 'Honda', 'Hyundai', 'Infiniti', 'Isuzu',
  'JAC', 'Jaguar', 'Jeep', 'Kia', 'Lada (ВАЗ)', 'Land Rover', 'Lexus', 'Lincoln', 'MG',
  'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Opel', 'Peugeot', 'Porsche',
  'Ravon', 'Renault', 'Rover', 'SEAT', 'Saab', 'Skoda', 'Smart', 'SsangYong', 'Subaru',
  'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'ZAZ (ЗАЗ)', 'Інша',
].sort((a, b) => a.localeCompare(b, 'uk'));

function carYears(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear + 1; y >= 1970; y--) {
    years.push(String(y));
  }
  return years;
}

export class CarBrandYearDropdowns1754801700000 implements MigrationInterface {
  name = 'CarBrandYearDropdowns1754801700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "category_attributes"
        SET "dataType" = 'enum', "enumOptions" = $2::jsonb
        WHERE "key" = 'brand'
          AND "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" = $1 AND "parentId" IS NOT NULL)
      `,
      ['lehkovi-avtomobili', JSON.stringify({ values: CAR_BRANDS })],
    );

    await queryRunner.query(
      `
        UPDATE "category_attributes"
        SET "dataType" = 'enum', "enumOptions" = $2::jsonb
        WHERE "key" = 'year'
          AND "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" = $1 AND "parentId" IS NOT NULL)
      `,
      ['lehkovi-avtomobili', JSON.stringify({ values: carYears() })],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
        UPDATE "category_attributes"
        SET "dataType" = 'string', "enumOptions" = NULL
        WHERE "key" = 'brand'
          AND "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" = $1 AND "parentId" IS NOT NULL)
      `,
      ['lehkovi-avtomobili'],
    );

    await queryRunner.query(
      `
        UPDATE "category_attributes"
        SET "dataType" = 'number', "enumOptions" = NULL
        WHERE "key" = 'year'
          AND "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" = $1 AND "parentId" IS NOT NULL)
      `,
      ['lehkovi-avtomobili'],
    );
  }
}
