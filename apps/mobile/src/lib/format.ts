const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Договірна';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${new Intl.NumberFormat('uk-UA').format(price)} ${symbol}`;
}
