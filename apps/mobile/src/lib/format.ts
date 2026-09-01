const CURRENCY_SYMBOLS: Record<string, string> = { UAH: '₴', USD: '$', EUR: '€' };

export function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Договірна';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${new Intl.NumberFormat('uk-UA').format(price)} ${symbol}`;
}

// Портовано з apps/web/src/lib/format.ts (аудит 27.08) — той самий баг був і тут:
// {count} переглядів/оголошень завжди в одній формі незалежно від числа.
const UK_PLURAL_RULES = new Intl.PluralRules('uk');

/**
 * Intl.PluralRules('uk').select() дає КАТЕГОРІЮ (one/few/many/other), не форматований
 * рядок — категорії плюралізації мови стабільні між версіями ICU/RN Hermes, на відміну
 * від Intl.NumberFormat({style:'currency'}) чи форматів дат, тож тут немає ризику
 * розбіжності між збірками.
 */
function pluralizeUk(count: number, forms: { one: string; few: string; many: string }): string {
  const category = UK_PLURAL_RULES.select(count);
  if (category === 'one') return forms.one;
  if (category === 'few') return forms.few;
  return forms.many;
}

/** "1 оголошення" / "2 оголошення" / "5 оголошень". */
export function pluralizeListings(count: number): string {
  return pluralizeUk(count, { one: 'оголошення', few: 'оголошення', many: 'оголошень' });
}

/** "1 перегляд" / "2 перегляди" / "5 переглядів". */
export function pluralizeViews(count: number): string {
  return pluralizeUk(count, { one: 'перегляд', few: 'перегляди', many: 'переглядів' });
}

/** "1 день" / "2 дні" / "5 днів". */
export function pluralizeDays(count: number): string {
  return pluralizeUk(count, { one: 'день', few: 'дні', many: 'днів' });
}

export interface RelativeDate {
  /** "Сьогодні"/"Учора"/"N днів тому" до 30 днів, далі — точна дата. */
  label: string;
  /** Повна дата — для показу поруч/у тултіпі. */
  exact: string;
}

export function formatRelativeDate(iso: string): RelativeDate {
  const date = new Date(iso);
  const exact = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (diffDays <= 0) return { label: 'Сьогодні', exact };
  if (diffDays === 1) return { label: 'Учора', exact };
  if (diffDays < 30) return { label: `${diffDays} ${pluralizeDays(diffDays)} тому`, exact };
  return { label: exact, exact };
}

const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

/**
 * Intl.DateTimeFormat('uk-UA', {month:'long'}) дає називний відмінок ("серпень"), а
 * "На Вжику з ..." вимагає родового ("з серпня") — той самий баг, що на вебі
 * (SellerCard.tsx), той самий фікс: статична мапа замість форматера.
 */
export function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
}

export interface DescriptionBlock {
  type: 'paragraph' | 'list';
  lines: string[];
}

/**
 * MUST-аудит: опис оголошення міг злипатись у суцільний абзац — деякі описи не мають
 * жодного символу \n (лише пробільні прогалини там, де продавець тиснув Enter). Розбиваємо
 * і за реальними \n, і за 3+ пробілами поспіль (1-2 пробіли лишаємо — типова "крапка +
 * два пробіли" не має ламати абзац). Рядки з "-"/"•" на початку групуються в один список.
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
