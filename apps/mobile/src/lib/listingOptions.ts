import type { ListingStatus, ListingType } from './api';

const GENERAL_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

/** "Шукаю співробітника" / "шукаю роботу" — RN-порт apps/web/src/lib/listing-type.ts. */
const JOB_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'vacancy', label: 'Вакансія — шукаю співробітника' },
  { value: 'resume', label: 'Резюме — шукаю роботу' },
];

/** Підкатегорії кореневої "Робота" (robota) — той самий список, що web/src/lib/listing-type.ts. */
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

export function isJobCategory(categorySlug: string | null | undefined): boolean {
  return Boolean(categorySlug && JOB_CATEGORY_SLUGS.has(categorySlug));
}

export function getListingTypeOptions(categorySlug: string | null | undefined): { value: ListingType; label: string }[] {
  return isJobCategory(categorySlug) ? JOB_TYPE_OPTIONS : GENERAL_TYPE_OPTIONS;
}

export function getListingTypeLabel(value: string): string {
  return [...GENERAL_TYPE_OPTIONS, ...JOB_TYPE_OPTIONS].find((o) => o.value === value)?.label ?? value;
}

export const CURRENCY_OPTIONS = [
  { value: 'UAH', label: 'грн' },
  { value: 'USD', label: '$' },
  { value: 'EUR', label: '€' },
];

/** Не category-aware (на відміну від web lib/listing-condition.ts) — окрема (менша) відома прогалина, поза цим запитом. */
export const CONDITION_OPTIONS = [
  { value: 'new', label: 'Новий' },
  { value: 'used', label: 'Вживаний' },
  { value: 'for_parts', label: 'На запчастини' },
];

export const TITLE_MIN_LENGTH = 5;
export const DESCRIPTION_MIN_LENGTH = 10;

export const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_MODERATION: 'На модерації',
  ACTIVE: 'Активне',
  REJECTED: 'Відхилено',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано',
  EXPIRED: 'Термін минув',
  ARCHIVED: 'В архіві',
  BLOCKED: 'Заблоковано',
};

/** Ціна не може бути відʼємною — прибираємо "-" одразу при вводі, той самий підхід, що web-форми. */
export function sanitizeNonNegative(raw: string): string {
  return raw.replace(/[^0-9.]/g, '');
}
