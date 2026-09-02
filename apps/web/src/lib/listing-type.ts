export interface ListingTypeOption {
  value: string;
  label: string;
}

const GENERAL_TYPE_OPTIONS: ListingTypeOption[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

/** "Шукаю співробітника" / "шукаю роботу" — інша семантика, ніж товар/послуга, тож не "sell"/"service". */
const JOB_TYPE_OPTIONS: ListingTypeOption[] = [
  { value: 'vacancy', label: 'Вакансія — шукаю співробітника' },
  { value: 'resume', label: 'Резюме — шукаю роботу' },
];

/** Підкатегорії кореневої "Робота" (robota) — там самих оголошень-товарів не буває. */
const JOB_CATEGORY_SLUGS = new Set<string>([
  'robota',
  'rozdribna-torhivlia-prodazhi-zakupky',
  'lohistyka-sklad-dostavka',
  'budivnytstvo-oblytsiuvalni-roboty',
  'koll-tsentry-telekomunikatsii',
  'administratyvnyi-personal-hr-sekretariat',
  'okhorona-bezpeka',
  'klining-domashnii-personal',
  'krasa-fitnes-sport',
]);

export function isJobCategory(categorySlug: string | null): boolean {
  return Boolean(categorySlug && JOB_CATEGORY_SLUGS.has(categorySlug));
}

/** Категорія ще не обрана — безпечний дефолт: звичайні типи оголошень (товар/послуга). */
export function getListingTypeOptions(categorySlug: string | null): ListingTypeOption[] {
  return isJobCategory(categorySlug) ? JOB_TYPE_OPTIONS : GENERAL_TYPE_OPTIONS;
}

/**
 * Для показу вже збереженого значення (read-only перегляд/модерація) — незалежно від
 * поточної категорії шукає серед ОБОХ наборів, інакше збережене "vacancy" на екрані модератора
 * (categorySlug там може бути ще не завантажений) показало б сирий код замість підпису.
 */
export function getListingTypeLabel(value: string): string {
  return [...GENERAL_TYPE_OPTIONS, ...JOB_TYPE_OPTIONS].find((o) => o.value === value)?.label ?? value;
}
