import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Атрибути для "Легкові автомобілі" (підкатегорія "Авто") — без цього форма створення
 * оголошення про авто не показує жодних специфічних полів (рік, об'єм двигуна, модель,
 * потужність тощо), лише загальні title/price/description як для будь-якого товару.
 */
const CAR_ATTRIBUTES: {
  key: string;
  labelUk: string;
  dataType: 'string' | 'number' | 'enum';
  enumOptions?: string[];
  isRequired: boolean;
  isFilterable: boolean;
}[] = [
  { key: 'brand', labelUk: 'Марка', dataType: 'string', isRequired: true, isFilterable: true },
  { key: 'model', labelUk: 'Модель', dataType: 'string', isRequired: true, isFilterable: true },
  { key: 'year', labelUk: 'Рік випуску', dataType: 'number', isRequired: true, isFilterable: true },
  { key: 'engine_volume', labelUk: "Об'єм двигуна, л", dataType: 'number', isRequired: false, isFilterable: true },
  { key: 'power', labelUk: 'Потужність, к.с.', dataType: 'number', isRequired: false, isFilterable: true },
  { key: 'mileage', labelUk: 'Пробіг, км', dataType: 'number', isRequired: false, isFilterable: true },
  {
    key: 'transmission',
    labelUk: 'Коробка передач',
    dataType: 'enum',
    enumOptions: ['Механічна', 'Автоматична', 'Робот', 'Варіатор'],
    isRequired: false,
    isFilterable: true,
  },
  {
    key: 'fuel_type',
    labelUk: 'Тип палива',
    dataType: 'enum',
    enumOptions: ['Бензин', 'Дизель', 'Газ/Бензин', 'Гібрид', 'Електро'],
    isRequired: false,
    isFilterable: true,
  },
  {
    key: 'body_type',
    labelUk: 'Тип кузова',
    dataType: 'enum',
    enumOptions: ['Седан', 'Хетчбек', 'Універсал', 'Позашляховик', 'Мінівен', 'Купе', 'Кабріолет', 'Пікап'],
    isRequired: false,
    isFilterable: true,
  },
  {
    key: 'drive_type',
    labelUk: 'Привід',
    dataType: 'enum',
    enumOptions: ['Передній', 'Задній', 'Повний'],
    isRequired: false,
    isFilterable: true,
  },
  { key: 'color', labelUk: 'Колір', dataType: 'string', isRequired: false, isFilterable: false },
];

export class AddCarAttributes1754801600000 implements MigrationInterface {
  name = 'AddCarAttributes1754801600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (let i = 0; i < CAR_ATTRIBUTES.length; i++) {
      const attr = CAR_ATTRIBUTES[i];
      await queryRunner.query(
        `
          INSERT INTO "category_attributes"
            ("categoryId", "key", "labelUk", "dataType", "enumOptions", "isRequired", "isFilterable", "sortOrder")
          SELECT "id", $1, $2, $3, $4::jsonb, $5, $6, $7
          FROM "categories" WHERE "slug" = 'lehkovi-avtomobili' AND "parentId" IS NOT NULL
          ON CONFLICT DO NOTHING
        `,
        [
          attr.key,
          attr.labelUk,
          attr.dataType,
          attr.enumOptions ? JSON.stringify({ values: attr.enumOptions }) : null,
          attr.isRequired,
          attr.isFilterable,
          i,
        ],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "category_attributes"
      WHERE "categoryId" IN (SELECT "id" FROM "categories" WHERE "slug" = 'lehkovi-avtomobili' AND "parentId" IS NOT NULL)
        AND "key" = ANY(ARRAY['brand','model','year','engine_volume','power','mileage','transmission','fuel_type','body_type','drive_type','color'])
    `);
  }
}
