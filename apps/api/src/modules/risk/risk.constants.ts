/** docs/moderation.md §6. */
export const RISK_SIGNAL_TYPES = [
  'rapid_listing_creation',
  'duplicate_listings',
  'high_report_count',
  'mass_messaging',
  'multi_account_signal',
  'location_mismatch',
] as const;
export type RiskSignalType = (typeof RISK_SIGNAL_TYPES)[number];

/**
 * Ваги сигналів. Не production-каліброване значення (Admin Panel для тюнінгу не існує) —
 * прозорі round-number дефолти, як і BANNED_WORDS у moderation.constants.ts.
 * Задетектовано (мають реальний тригер нижче): rapid_listing_creation, duplicate_listings,
 * high_report_count. Заведені в enum, але без детектора в цьому зрізі: mass_messaging
 * (потребує аналізу вмісту повідомлень чату), multi_account_signal (потребує IP-трекінгу на
 * реєстрації, зараз IP пробрасывается лише в otp/request, не verify/Google callback).
 * location_mismatch — явно "Phase 2" за docs/moderation.md §6, поза MVP.
 */
export const RISK_SIGNAL_WEIGHTS: Record<RiskSignalType, number> = {
  rapid_listing_creation: 5,
  duplicate_listings: 8,
  high_report_count: 15,
  mass_messaging: 10,
  multi_account_signal: 12,
  location_mismatch: 6,
};

export const RAPID_LISTING_CREATION_THRESHOLD = 5;
export const RAPID_LISTING_CREATION_WINDOW_MS = 60 * 60 * 1000; // 1 година
export const DUPLICATE_LISTING_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 години
export const HIGH_REPORT_COUNT_THRESHOLD = 3;
