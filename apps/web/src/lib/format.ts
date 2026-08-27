const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

/**
 * НЕ використовує Intl.NumberFormat({style:'currency'}) — Node (small-icu, дефолтна збірка
 * без full-icu) і браузер по-різному резолвлять символ валюти для 'uk-UA' (сервер віддає
 * інший рядок, ніж клієнт), що ламає SSR-гідратацію (React discard + remount піддерева,
 * зайва робота й миготіння). Символ підставляємо самі — детерміновано однаково всюди.
 */
export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Договірна';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${new Intl.NumberFormat('uk-UA').format(price)} ${symbol}`;
}

/** "1 оголошення" / "2 оголошення" / "5 оголошень" — стандартні укр. правила відмінювання лічильників. */
export function pluralizeListings(count: number): string {
  return count % 10 === 1 && count % 100 !== 11 ? 'оголошення' : 'оголошень';
}
