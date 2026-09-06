import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * listing.constants.ts LISTING_TYPES вже давно містить 'vacancy'/'resume' (job-категорії
 * "Робота" на фронтенді пропонують саме ці типи), але жодна попередня міграція так і не
 * додала їх у сам Postgres-енум "listing_type_enum" (початково створений у
 * 1754800100000-AddListingsCore.ts лише з 'sell'/'buy'/'exchange'/'give_away'/'service'/'rent').
 * Наслідок: INSERT з listingType='vacancy' чи 'resume' падає з "invalid input value for
 * enum listing_type_enum" — некерований виняток, що AllExceptionsFilter показує юзеру як
 * generic "Внутрішня помилка сервера" при спробі опублікувати будь-яке оголошення в
 * категорії "Робота" (вакансія чи резюме).
 */
export class AddJobListingTypes1754802700000 implements MigrationInterface {
  name = 'AddJobListingTypes1754802700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... ADD VALUE не можна виконати в тій самій транзакції, де нове значення
    // одразу використовується, але саме додавання значення (без використання) у транзакції
    // дозволене з PostgreSQL 12+ — TypeORM запускає кожну міграцію у своїй транзакції.
    await queryRunner.query(`ALTER TYPE "listing_type_enum" ADD VALUE IF NOT EXISTS 'vacancy'`);
    await queryRunner.query(`ALTER TYPE "listing_type_enum" ADD VALUE IF NOT EXISTS 'resume'`);
  }

  public async down(): Promise<void> {
    // PostgreSQL не підтримує видалення значення enum (потребувало б перестворення типу
    // й перезапису всіх залежних колонок/даних) — навмисно немає відкату, як і для інших
    // ALTER TYPE ADD VALUE у практиці Postgres-міграцій.
  }
}
