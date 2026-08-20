import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Підкатегорії для 12 з 14 топ-категорій, зібрані звірянням зі структурою olx.ua
 * (Дитячий світ уже мав власні підкатегорії; Безкоштовно/Обмін на OLX теж без
 * підкатегорій — це наскрізні listingType-фільтри, а не окрема таксономія).
 * parentId шукається по nameUk топ-категорії (level=0), а не хардкодиться —
 * категорії цього проєкту наразі не мають власної seed-міграції, тож id можуть
 * відрізнятись між середовищами.
 */
const SUBCATEGORIES: Record<string, { nameUk: string; slug: string }[]> = {
  'Нерухомість': [
    { nameUk: 'Квартири', slug: 'kvartyry' },
    { nameUk: 'Кімнати', slug: 'kimnaty' },
    { nameUk: 'Будинки', slug: 'budynky' },
    { nameUk: 'Земля', slug: 'zemlia' },
    { nameUk: 'Комерційна нерухомість', slug: 'komertsiina-nerukhomist' },
    { nameUk: 'Гаражі, парковки', slug: 'harazhi-parkovky' },
    { nameUk: 'Нерухомість за кордоном', slug: 'nerukhomist-za-kordonom' },
  ],
  'Авто': [
    { nameUk: 'Легкові автомобілі', slug: 'lehkovi-avtomobili' },
    { nameUk: 'Вантажні автомобілі', slug: 'vantazhni-avtomobili' },
    { nameUk: 'Автобуси', slug: 'avtobusy' },
    { nameUk: 'Мото', slug: 'moto' },
    { nameUk: 'Спецтехніка', slug: 'spetstekhnika' },
    { nameUk: 'Сільгосптехніка', slug: 'silhosptekhnika' },
    { nameUk: 'Водний транспорт', slug: 'vodnyi-transport' },
    { nameUk: 'Автомобілі з Польщі', slug: 'avtomobili-z-polshchi' },
  ],
  'Запчастини': [
    { nameUk: 'Автозапчастини', slug: 'avtozapchastyny' },
    { nameUk: 'Аксесуари для авто', slug: 'aksesuary-dlia-avto' },
    { nameUk: 'Запчастини для вантажівок', slug: 'zapchastyny-dlia-vantazhivok' },
    { nameUk: 'Запчастини для сільгосптехніки', slug: 'zapchastyny-dlia-silhosptekhniky' },
    { nameUk: 'Шини, диски і колеса', slug: 'shyny-dysky-i-kolesa' },
    { nameUk: 'Транспорт на запчастини', slug: 'transport-na-zapchastyny' },
    { nameUk: 'Мотозапчастини та мотоаксесуари', slug: 'motozapchastyny-ta-motoaksesuary' },
    { nameUk: 'Мастила та автохімія', slug: 'mastyla-ta-avtokhimiia' },
  ],
  'Електроніка': [
    { nameUk: 'Телефони та аксесуари', slug: 'telefony-ta-aksesuary' },
    { nameUk: "Комп'ютери та комплектуючі", slug: 'kompiutery-ta-komplektuiuchi' },
    { nameUk: 'Фото / відео', slug: 'foto-video' },
    { nameUk: 'Тв / відеотехніка', slug: 'tv-videotekhnika' },
    { nameUk: 'Аудіотехніка', slug: 'audiotekhnika' },
    { nameUk: 'Ігри та ігрові приставки', slug: 'ihry-ta-ihrovi-prystavky' },
    { nameUk: 'Планшети / ел. книги та аксесуари', slug: 'planshety-el-knyhy-ta-aksesuary' },
    { nameUk: 'Ноутбуки та аксесуари', slug: 'noutbuky-ta-aksesuary' },
    { nameUk: 'Техніка для дому', slug: 'tekhnika-dlia-domu' },
    { nameUk: 'Техніка для кухні', slug: 'tekhnika-dlia-kukhni' },
    { nameUk: 'Кліматичне обладнання', slug: 'klimatychne-obladnannia' },
    { nameUk: 'Індивідуальний догляд', slug: 'indyvidualnyi-dohliad' },
    { nameUk: 'Аксесуари й комплектуючі', slug: 'aksesuary-y-komplektuiuchi' },
    { nameUk: 'Інша електроніка', slug: 'insha-elektronika' },
  ],
  'Дім і сад': [
    { nameUk: 'Канцтовари / витратні матеріали', slug: 'kantstovary-vytratni-materialy' },
    { nameUk: 'Меблі', slug: 'mebli' },
    { nameUk: 'Продукти харчування / напої', slug: 'produkty-kharchuvannia-napoi' },
    { nameUk: 'Сад / город', slug: 'sad-horod' },
    { nameUk: "Предмети інтер'єру", slug: 'predmety-interieru' },
    { nameUk: 'Будівництво / ремонт', slug: 'budivnytstvo-remont' },
    { nameUk: 'Інструменти', slug: 'instrumenty' },
    { nameUk: 'Кімнатні рослини', slug: 'kimnatni-roslyny' },
  ],
  'Мода і стиль': [
    { nameUk: 'Жіночий одяг', slug: 'zhinochyi-odiah' },
    { nameUk: 'Жіноче взуття', slug: 'zhinoche-vzuttia' },
    { nameUk: 'Чоловічий одяг', slug: 'cholovichyi-odiah' },
    { nameUk: 'Чоловіче взуття', slug: 'choloviche-vzuttia' },
    { nameUk: 'Жіноча білизна та купальники', slug: 'zhinocha-bilyzna-ta-kupalnyky' },
    { nameUk: 'Чоловіча білизна та плавки', slug: 'cholovicha-bilyzna-ta-plavky' },
    { nameUk: 'Головні убори', slug: 'holovni-ubory' },
    { nameUk: 'Для весілля', slug: 'dlia-vesillia' },
  ],
  'Хобі, відпочинок і спорт': [
    { nameUk: 'Антикваріат / колекції', slug: 'antykvariat-kolektsii' },
    { nameUk: 'Музичні інструменти', slug: 'muzychni-instrumenty' },
    { nameUk: 'Спорт / відпочинок', slug: 'sport-vidpochynok' },
    { nameUk: 'Вело', slug: 'velo' },
    { nameUk: 'Мілітарія', slug: 'militariia' },
    { nameUk: 'Квадрокоптери та аксесуари', slug: 'kvadrokoptery-ta-aksesuary' },
    { nameUk: 'Книги / журнали', slug: 'knyhy-zhurnaly' },
    { nameUk: 'CD / DVD / Платівки', slug: 'cd-dvd-plativky' },
  ],
  'Робота': [
    { nameUk: 'Роздрібна торгівля, продажі, закупки', slug: 'rozdribna-torhivlia-prodazhi-zakupky' },
    { nameUk: 'Логістика, склад, доставка', slug: 'lohistyka-sklad-dostavka' },
    { nameUk: 'Будівництво, облицювальні роботи', slug: 'budivnytstvo-oblytsiuvalni-roboty' },
    { nameUk: 'Колл-центри, телекомунікації', slug: 'koll-tsentry-telekomunikatsii' },
    { nameUk: 'Адміністративний персонал, HR, секретаріат', slug: 'administratyvnyi-personal-hr-sekretariat' },
    { nameUk: 'Охорона, безпека', slug: 'okhorona-bezpeka' },
    { nameUk: 'Клінінг, домашній персонал', slug: 'klining-domashnii-personal' },
    { nameUk: 'Краса, фітнес, спорт', slug: 'krasa-fitnes-sport' },
  ],
  'Бізнес та послуги': [
    { nameUk: 'Авто / мото послуги', slug: 'avto-moto-posluhy' },
    { nameUk: "Краса / здоров'я", slug: 'krasa-zdorovia' },
    { nameUk: 'Догляд за дітьми та літніми людьми', slug: 'dohliad-za-ditmy-ta-litnimy-liudmy' },
    { nameUk: 'Побутові послуги', slug: 'pobutovi-posluhy' },
    { nameUk: 'Клінінг', slug: 'klining' },
    { nameUk: 'Послуги освіти та спорту', slug: 'posluhy-osvity-ta-sportu' },
    { nameUk: 'Перевезення та послуги спецтехніки', slug: 'perevezennia-ta-posluhy-spetstekhniky' },
    { nameUk: 'Фото та відеозйомка', slug: 'foto-ta-videozyomka' },
  ],
  'Тварини': [
    { nameUk: 'Собаки', slug: 'sobaky' },
    { nameUk: 'Коти', slug: 'koty' },
    { nameUk: 'Акваріумістика', slug: 'akvariumistyka' },
    { nameUk: 'Гризуни', slug: 'hryzuny' },
    { nameUk: 'Сільгосп тварини', slug: 'silhosp-tvaryny' },
    { nameUk: 'Інші тварини', slug: 'inshi-tvaryny' },
    { nameUk: 'Зоотовари', slug: 'zootovary' },
  ],
  'Оренда та прокат': [
    { nameUk: 'Оренда транспорту та спецтехніки', slug: 'orenda-transportu-ta-spetstekhniky' },
    { nameUk: 'Прокат велосипедів і мото', slug: 'prokat-velosypediv-i-moto' },
    { nameUk: 'Оренда обладнання', slug: 'orenda-obladnannia' },
    { nameUk: 'Прокат інструментів', slug: 'prokat-instrumentiv' },
    { nameUk: 'Прокат товарів мед призначення', slug: 'prokat-tovariv-med-pryznachennia' },
    { nameUk: 'Прокат техніки та електроніки', slug: 'prokat-tekhniky-ta-elektroniky' },
    { nameUk: 'Прокат товарів для заходів', slug: 'prokat-tovariv-dlia-zakhodiv' },
    { nameUk: 'Прокат спорт і туристичних товарів', slug: 'prokat-sport-i-turystychnykh-tovariv' },
  ],
  'Житло подобово': [
    { nameUk: 'Будинки подобово, погодинно', slug: 'budynky-podobovo-pohodynno' },
    { nameUk: 'Квартири подобово, погодинно', slug: 'kvartyry-podobovo-pohodynno' },
    { nameUk: 'Кімнати подобово, погодинно', slug: 'kimnaty-podobovo-pohodynno' },
    { nameUk: 'Готелі, бази відпочинку', slug: 'hoteli-bazy-vidpochynku' },
    { nameUk: 'Хостели, койко-місця', slug: 'khosteli-koiko-mistsia' },
  ],
};

export class AddCategorySubcategories1754801500000 implements MigrationInterface {
  name = 'AddCategorySubcategories1754801500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [parentName, subs] of Object.entries(SUBCATEGORIES)) {
      for (let i = 0; i < subs.length; i++) {
        const { nameUk, slug } = subs[i];
        await queryRunner.query(
          `
            INSERT INTO "categories" ("parentId", "nameUk", "slug", "sortOrder", "level")
            SELECT "id", $1, $2, $3, 1 FROM "categories" WHERE "nameUk" = $4 AND "parentId" IS NULL
            ON CONFLICT DO NOTHING
          `,
          [nameUk, slug, i, parentName],
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [parentName, subs] of Object.entries(SUBCATEGORIES)) {
      const slugs = subs.map((s) => s.slug);
      await queryRunner.query(
        `
          DELETE FROM "categories"
          WHERE "slug" = ANY($1)
            AND "parentId" IN (SELECT "id" FROM "categories" WHERE "nameUk" = $2 AND "parentId" IS NULL)
        `,
        [slugs, parentName],
      );
    }
  }
}
