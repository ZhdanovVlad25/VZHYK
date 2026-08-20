import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Дотепер лише Київська область мала правильного батька (locations.parentId) — решта
 * 20 міст (Харків, Одеса, Дніпро…) висіли одразу під "Україна" без області: їх завела
 * не ця кодова база (немає відповідного seed), а прямий INSERT під час паралельної
 * роботи над location-модулем. UI вибору міста в оголошенні переходить на дворівневий
 * вибір "Область → місто" — без області ці 20 міст лишились би "сирітками" в новому
 * дереві. Ця міграція:
 *   1. заводить усі 24 області (Крим/Севастополь свідомо поза межами — окремий
 *      адміністративний статус, не потрібен для MVP і не додає цінності вибору);
 *   2. перепідпорядковує наявні міста (за slug, UPDATE — не DELETE+INSERT, бо на них
 *      уже посилаються listings.locationId/profiles.cityLocationId, FK RESTRICT);
 *   3. додає ще кілька міст на область (у т.ч. Самар — Дніпропетровська обл.,
 *      колишній Новомосковськ, і Самбір — Львівська обл., за проханням користувача).
 * Ідемпотентна: перевіряє існування за slug перед INSERT, тож повторний прогін —
 * no-op.
 */
export class SeedOblastsAndCities1754801300000 implements MigrationInterface {
  name = 'SeedOblastsAndCities1754801300000';

  private readonly oblasts: { nameUk: string; slug: string; cities: { nameUk: string; slug: string }[] }[] = [
    { nameUk: 'Вінницька область', slug: 'vinnytska-oblast', cities: [{ nameUk: 'Вінниця', slug: 'vinnytsia' }] },
    {
      nameUk: 'Волинська область',
      slug: 'volynska-oblast',
      cities: [
        { nameUk: 'Луцьк', slug: 'lutsk' },
        { nameUk: 'Ковель', slug: 'kovel' },
      ],
    },
    {
      nameUk: 'Дніпропетровська область',
      slug: 'dnipropetrovska-oblast',
      cities: [
        { nameUk: 'Дніпро', slug: 'dnipro' },
        { nameUk: 'Кривий Ріг', slug: 'kryvyi-rih' },
        { nameUk: 'Самар', slug: 'samar' },
        { nameUk: "Кам'янське", slug: 'kamianske' },
      ],
    },
    {
      nameUk: 'Донецька область',
      slug: 'donetska-oblast',
      cities: [
        { nameUk: 'Краматорськ', slug: 'kramatorsk' },
        { nameUk: 'Маріуполь', slug: 'mariupol' },
      ],
    },
    { nameUk: 'Житомирська область', slug: 'zhytomyrska-oblast', cities: [{ nameUk: 'Житомир', slug: 'zhytomyr' }] },
    {
      nameUk: 'Закарпатська область',
      slug: 'zakarpatska-oblast',
      cities: [
        { nameUk: 'Ужгород', slug: 'uzhhorod' },
        { nameUk: 'Мукачево', slug: 'mukachevo' },
      ],
    },
    {
      nameUk: 'Запорізька область',
      slug: 'zaporizka-oblast',
      cities: [
        { nameUk: 'Запоріжжя', slug: 'zaporizhzhia' },
        { nameUk: 'Мелітополь', slug: 'melitopol' },
        { nameUk: 'Бердянськ', slug: 'berdiansk' },
      ],
    },
    {
      nameUk: 'Івано-Франківська область',
      slug: 'ivano-frankivska-oblast',
      cities: [{ nameUk: 'Івано-Франківськ', slug: 'ivano-frankivsk' }],
    },
    {
      nameUk: 'Київська область',
      slug: 'kyivska-oblast',
      cities: [
        { nameUk: 'Київ', slug: 'kyiv' },
        { nameUk: 'Біла Церква', slug: 'bila-tserkva' },
        { nameUk: 'Бровари', slug: 'brovary' },
        { nameUk: 'Ірпінь', slug: 'irpin' },
      ],
    },
    { nameUk: 'Кіровоградська область', slug: 'kirovohradska-oblast', cities: [{ nameUk: 'Кропивницький', slug: 'kropyvnytskyi' }] },
    {
      nameUk: 'Луганська область',
      slug: 'luhanska-oblast',
      cities: [
        { nameUk: 'Сєвєродонецьк', slug: 'sievierodonetsk' },
        { nameUk: 'Лисичанськ', slug: 'lysychansk' },
      ],
    },
    {
      nameUk: 'Львівська область',
      slug: 'lvivska-oblast',
      cities: [
        { nameUk: 'Львів', slug: 'lviv' },
        { nameUk: 'Самбір', slug: 'sambir' },
        { nameUk: 'Дрогобич', slug: 'drohobych' },
        { nameUk: 'Стрий', slug: 'stryi' },
      ],
    },
    { nameUk: 'Миколаївська область', slug: 'mykolaivska-oblast', cities: [{ nameUk: 'Миколаїв', slug: 'mykolaiv' }] },
    {
      nameUk: 'Одеська область',
      slug: 'odeska-oblast',
      cities: [
        { nameUk: 'Одеса', slug: 'odesa' },
        { nameUk: 'Ізмаїл', slug: 'izmail' },
        { nameUk: 'Чорноморськ', slug: 'chornomorsk' },
      ],
    },
    {
      nameUk: 'Полтавська область',
      slug: 'poltavska-oblast',
      cities: [
        { nameUk: 'Полтава', slug: 'poltava' },
        { nameUk: 'Кременчук', slug: 'kremenchuk' },
      ],
    },
    { nameUk: 'Рівненська область', slug: 'rivnenska-oblast', cities: [{ nameUk: 'Рівне', slug: 'rivne' }] },
    {
      nameUk: 'Сумська область',
      slug: 'sumska-oblast',
      cities: [
        { nameUk: 'Суми', slug: 'sumy' },
        { nameUk: 'Конотоп', slug: 'konotop' },
      ],
    },
    { nameUk: 'Тернопільська область', slug: 'ternopilska-oblast', cities: [{ nameUk: 'Тернопіль', slug: 'ternopil' }] },
    {
      nameUk: 'Харківська область',
      slug: 'kharkivska-oblast',
      cities: [
        { nameUk: 'Харків', slug: 'kharkiv' },
        { nameUk: 'Ізюм', slug: 'izium' },
        { nameUk: 'Лозова', slug: 'lozova' },
      ],
    },
    {
      nameUk: 'Херсонська область',
      slug: 'khersonska-oblast',
      cities: [
        { nameUk: 'Херсон', slug: 'kherson' },
        { nameUk: 'Нова Каховка', slug: 'nova-kakhovka' },
      ],
    },
    {
      nameUk: 'Хмельницька область',
      slug: 'khmelnytska-oblast',
      cities: [
        { nameUk: 'Хмельницький', slug: 'khmelnytskyi' },
        { nameUk: "Кам'янець-Подільський", slug: 'kamianets-podilskyi' },
      ],
    },
    {
      nameUk: 'Черкаська область',
      slug: 'cherkaska-oblast',
      cities: [
        { nameUk: 'Черкаси', slug: 'cherkasy' },
        { nameUk: 'Умань', slug: 'uman' },
      ],
    },
    { nameUk: 'Чернівецька область', slug: 'chernivetska-oblast', cities: [{ nameUk: 'Чернівці', slug: 'chernivtsi' }] },
    {
      nameUk: 'Чернігівська область',
      slug: 'chernihivska-oblast',
      cities: [
        { nameUk: 'Чернігів', slug: 'chernihiv' },
        { nameUk: 'Ніжин', slug: 'nizhyn' },
      ],
    },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // "Україна" (root, level='country') раніше існувала лише через ручний run-seed.ts,
    // якого продакшн ніколи не запускав — ця міграція мовчки no-op'ала на порожній
    // locations-таблиці (жодної помилки, просто return). Тепер створює корінь сама,
    // якщо його ще нема, замість покладатись на зовнішній seed-скрипт.
    let [ukraine] = await queryRunner.query(`SELECT id FROM locations WHERE slug = 'ukraine'`);
    if (!ukraine) {
      [ukraine] = await queryRunner.query(
        `INSERT INTO locations (level, "nameUk", slug, "parentId") VALUES ('country', 'Україна', 'ukraine', NULL) RETURNING id`,
      );
    }

    for (const oblast of this.oblasts) {
      const [existingOblast] = await queryRunner.query(`SELECT id FROM locations WHERE slug = $1`, [oblast.slug]);
      let oblastId: string = existingOblast?.id;
      if (!oblastId) {
        const [inserted] = await queryRunner.query(
          `INSERT INTO locations (level, "nameUk", slug, "parentId") VALUES ('region', $1, $2, $3) RETURNING id`,
          [oblast.nameUk, oblast.slug, ukraine.id],
        );
        oblastId = inserted.id;
      }

      for (const city of oblast.cities) {
        const [existingCity] = await queryRunner.query(`SELECT id FROM locations WHERE slug = $1`, [city.slug]);
        if (existingCity) {
          await queryRunner.query(`UPDATE locations SET "parentId" = $1 WHERE id = $2`, [oblastId, existingCity.id]);
        } else {
          await queryRunner.query(
            `INSERT INTO locations (level, "nameUk", slug, "parentId") VALUES ('city', $1, $2, $3)`,
            [city.nameUk, city.slug, oblastId],
          );
        }
      }
    }
  }

  public async down(): Promise<void> {
    // Свідомо no-op: видалення locations може зламати FK з listings/profiles, які вже
    // посилаються на перепідпорядковані міста (той самий підхід, що categories, decisions.md
    // DEC-03). Відкат структури областей — вручну, за потреби.
  }
}
