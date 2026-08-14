const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

/**
 * НЕ використовує Intl.NumberFormat({style:'currency'}) — Node (small-icu, дефолтна збірка
 * без full-icu) і браузер по-різному резолвлять символ валюти для 'uk-UA' (сервер віддає
 * інший рядок, ніж клієнт), що ламає SSR-гідратацію (React discard + remount піддерева,
 * зайва робота й миготіння). Символ підставляємо самі — детерміновано однаково всюди.
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Ціна не вказана';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${new Intl.NumberFormat('uk-UA').format(price)} ${symbol}`;
}
