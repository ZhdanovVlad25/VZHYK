export const LISTING_TYPES = ['sell', 'buy', 'exchange', 'give_away', 'service', 'rent'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const LISTING_CURRENCIES = ['UAH', 'USD', 'EUR'] as const;
export type ListingCurrency = (typeof LISTING_CURRENCIES)[number];

export const LISTING_CONDITIONS = ['new', 'used', 'for_parts'] as const;
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];

/** docs/architecture.md §6 State Machine (Listing) */
export const LISTING_STATUSES = [
  'DRAFT',
  'PENDING_MODERATION',
  'ACTIVE',
  'REJECTED',
  'RESERVED',
  'SOLD',
  'EXPIRED',
  'ARCHIVED',
  'BLOCKED',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** listing_type, для яких price не обов'язкове (docs/api.md §5) */
export const LISTING_TYPES_WITHOUT_REQUIRED_PRICE: ListingType[] = ['buy', 'give_away'];

/** Статуси, видимі анонімному відвідувачу/іншим користувачам (docs/api.md §5, §8). */
export const PUBLICLY_VISIBLE_LISTING_STATUSES: ListingStatus[] = ['ACTIVE', 'RESERVED', 'SOLD'];
