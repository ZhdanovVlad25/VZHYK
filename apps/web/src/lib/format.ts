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

const UK_PLURAL_RULES = new Intl.PluralRules('uk');

/**
 * MUST-аудит: "Знайдено 3 оголошень" замість "3 оголошення". Стара версія перевіряла лише
 * count % 10 === 1 (укр. категорія "one": 1, 21, 31…) і все інше валила в "оголошень" —
 * забула категорію "few" (2-4, 22-24…), яка для слова "оголошення" звучить ТАК САМО, як
 * "one" ("2 оголошення", не "2 оголошень"), тому й ловилась лише на count=1, не на 2-4.
 * Intl.PluralRules('uk').select() дає саме КАТЕГОРІЮ (one/few/many/other) — не форматований
 * рядок (як Intl.NumberFormat({style:'currency'}), formatPrice), тож крос-середовищна різниця
 * версій ICU тут не загрожує SSR-гідратації: правила плюралізації мови в CLDR стабільні.
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
  /** Показується в UI: "Сьогодні"/"Учора"/"N днів тому" до 30 днів, далі — точна дата. */
  label: string;
  /** Завжди повна дата — для title (tooltip) і <time datetime>. */
  exact: string;
}

/**
 * MUST-аудит: "Опубліковано 24 серпня 2026 р." вимагає рахунку в голові — "3 дні тому" прямо
 * сигналізує свіжість. Точну дату не губимо: викликач кладе `exact` в title і `iso` в
 * <time dateTime>, так само доступно скрін-рідерам/пошуковикам, як і раніше.
 */
export function formatRelativeDate(iso: string): RelativeDate {
  const date = new Date(iso);
  const exact = new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (diffDays <= 0) return { label: 'Сьогодні', exact };
  if (diffDays === 1) return { label: 'Учора', exact };
  if (diffDays < 30) return { label: `${diffDays} ${pluralizeDays(diffDays)} тому`, exact };
  return { label: exact, exact };
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
