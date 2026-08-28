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

export interface DescriptionBlock {
  type: 'paragraph' | 'list';
  lines: string[];
}

/**
 * MUST-аудит: опис Kia Sportage злипся в суцільний абзац — комплектація через дефіси
 * читалась одним реченням. Причина глибша, ніж просто "\n не рендериться" (whitespace-pre-wrap
 * вже стоїть на контейнері): жива перевірка API показала, що в тексті НЕМА жодного символу
 * \n узагалі — лише пробільні прогалини (3-5 пробілів) там, де продавець тиснув Enter. pre-wrap
 * зберігає лише те, що Є в рядку, тож коли переносу нема що зберігати — не допомагає.
 * Розбиваємо і за реальними \n (майбутні описи через Textarea), і за 3+ пробілами поспіль
 * (цей кейс) — 1-2 пробіли лишаємо як є (типова "крапка + два пробіли" не має ламати абзац).
 * Рядки з "-"/"•" на початку групуються в один <ul>.
 */
export function parseDescription(raw: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  const segments = raw
    .split(/\n+|[ \t]{3,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const isListItem = /^[-•]\s+/.test(segment);
    const text = isListItem ? segment.replace(/^[-•]\s+/, '') : segment;
    const last = blocks[blocks.length - 1];
    if (isListItem && last?.type === 'list') {
      last.lines.push(text);
    } else if (isListItem) {
      blocks.push({ type: 'list', lines: [text] });
    } else {
      blocks.push({ type: 'paragraph', lines: [text] });
    }
  }
  return blocks;
}
