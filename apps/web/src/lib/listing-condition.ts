export interface ConditionOption {
  value: 'new' | 'used' | 'for_parts';
  label: string;
}

const ALL_CONDITION_OPTIONS: ConditionOption[] = [
  { value: 'used', label: 'Вживаний' },
  { value: 'new', label: 'Новий' },
  { value: 'for_parts', label: 'На запчастини' },
];

/**
 * "На запчастини" має сенс лише для того, що реально розбирають на компоненти (авто,
 * електроніка з ремонтопридатними деталями, техніка з двигуном/механізмом) — не для одягу,
 * живності, нерухомості, продуктів, оренди чи вже готових запчастин самих по собі.
 * Звірено з тим, як OLX показує "Стан" за категоріями (напр. для шин там лише
 * Новий/Вживане, без "на запчастини" — саме це й було приводом для цього списку).
 *
 * Слуги/оренда/подобово виключені цілком — там "Стан" як "новий/вживаний" товару вже
 * сумнівний, а "на запчастини" не має сенсу апріорі.
 */
const CATEGORIES_WITHOUT_FOR_PARTS = new Set<string>([
  // Мода і стиль — одяг/взуття не розбирають на запчастини.
  'zhinochyi-odiah',
  'zhinoche-vzuttia',
  'cholovichyi-odiah',
  'choloviche-vzuttia',
  'zhinocha-bilyzna-ta-kupalnyky',
  'cholovicha-bilyzna-ta-plavky',
  'holovni-ubory',
  'dlia-vesillia',

  // Дитячий світ — лише "м'які"/текстильні підкатегорії; візки/автокрісла/дитячі меблі/
  // транспорт лишаються (у них є з чого розібрати на запчастини).
  'dytiachyi-odiah',
  'dytiache-vzuttia',
  'hoduvannia',
  'tovary-dlia-shkoliariv',
  'ihrashky',

  // Нерухомість — "на запчастини" не застосовується до житла/землі.
  'kvartyry',
  'kimnaty',
  'budynky',
  'zemlia',
  'komertsiina-nerukhomist',
  'harazhi-parkovky',
  'nerukhomist-za-kordonom',

  // Запчастини — сама категорія вже "запчастини", повторне "на запчастини" для конкретної
  // деталі чи для "транспорт на запчастини" (де це вже сенс усієї категорії) зайве. Шини —
  // прямий привід цього списку (OLX не пропонує цей стан для гуми).
  'avtozapchastyny',
  'aksesuary-dlia-avto',
  'zapchastyny-dlia-vantazhivok',
  'zapchastyny-dlia-silhosptekhniky',
  'shyny-dysky-i-kolesa',
  'transport-na-zapchastyny',
  'motozapchastyny-ta-motoaksesuary',
  'mastyla-ta-avtokhimiia',

  // Дім і сад — витратні матеріали/декор/рослини/продукти не "розбирають".
  'kantstovary-vytratni-materialy',
  'produkty-kharchuvannia-napoi',
  'predmety-interieru',
  'budivnytstvo-remont',
  'kimnatni-roslyny',

  // Хобі — колекційні/медіа-товари, не механізми.
  'antykvariat-kolektsii',
  'knyhy-zhurnaly',
  'cd-dvd-plativky',
  'militariia',

  // Електроніка — дрібні аксесуари/догляд, не самостійні пристрої з деталями.
  'aksesuary-y-komplektuiuchi',
  'indyvidualnyi-dohliad',

  // Тварини — живі істоти й супутні товари, "на запчастини" не застосовується апріорі.
  'sobaky',
  'koty',
  'akvariumistyka',
  'hryzuny',
  'silhosp-tvaryny',
  'inshi-tvaryny',
  'zootovary',

  // Оренда та прокат — орендують робочий товар, а не "на запчастини".
  'orenda-transportu-ta-spetstekhniky',
  'prokat-velosypediv-i-moto',
  'orenda-obladnannia',
  'prokat-instrumentiv',
  'prokat-tovariv-med-pryznachennia',
  'prokat-tekhniky-ta-elektroniky',
  'prokat-tovariv-dlia-zakhodiv',
  'prokat-sport-i-turystychnykh-tovariv',

  // Житло подобово — коротка оренда житла, не товар.
  'budynky-podobovo-pohodynno',
  'kvartyry-podobovo-pohodynno',
  'kimnaty-podobovo-pohodynno',
  'hoteli-bazy-vidpochynku',
  'khosteli-koiko-mistsia',
]);

/**
 * Категорія ще не обрана (slug === null) — показуємо всі варіанти (безпечний дефолт,
 * той самий, що й раніше для всіх категорій). currentValue завжди лишається в списку,
 * навіть якщо категорія його виключає — щоб не губити мовчки вже збережене значення
 * старого оголошення при редагуванні.
 */
export function getConditionOptions(
  categorySlug: string | null,
  currentValue?: string | null,
): ConditionOption[] {
  if (!categorySlug || !CATEGORIES_WITHOUT_FOR_PARTS.has(categorySlug)) {
    return ALL_CONDITION_OPTIONS;
  }
  if (currentValue === 'for_parts') {
    return ALL_CONDITION_OPTIONS;
  }
  return ALL_CONDITION_OPTIONS.filter((o) => o.value !== 'for_parts');
}
