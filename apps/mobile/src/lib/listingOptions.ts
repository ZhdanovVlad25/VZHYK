import type { ListingStatus, ListingType } from './api';

export const LISTING_TYPE_OPTIONS: { value: ListingType; label: string }[] = [
  { value: 'sell', label: 'Продаю' },
  { value: 'buy', label: 'Куплю' },
  { value: 'exchange', label: 'Обміняю' },
  { value: 'give_away', label: 'Віддам безкоштовно' },
  { value: 'service', label: 'Послуга' },
  { value: 'rent', label: 'Оренда' },
];

export const CURRENCY_OPTIONS = [
  { value: 'UAH', label: 'грн' },
  { value: 'USD', label: '$' },
  { value: 'EUR', label: '€' },
];

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
