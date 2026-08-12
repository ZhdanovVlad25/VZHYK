const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'h',
  ґ: 'g',
  д: 'd',
  е: 'e',
  є: 'ie',
  ж: 'zh',
  з: 'z',
  и: 'y',
  і: 'i',
  ї: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ь: '',
  ю: 'iu',
  я: 'ia',
};

/** Транслітерація uk → латиниця (спрощена, для URL) + типова slug-нормалізація. Не для показу користувачу, лише для читабельного хвоста URL. */
export function slugify(text: string): string {
  const transliterated = text
    .toLowerCase()
    .split('')
    .map((ch) => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');

  return transliterated
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

const UUID_LENGTH = 36;

/** `/listings/{uuid}-{slug}` — slug суто косметичний, id завжди перші 36 символів параметра. */
export function buildListingHref(id: string, title: string): string {
  const slug = slugify(title);
  return slug ? `/listings/${id}-${slug}` : `/listings/${id}`;
}

/** Приймає як голий UUID (старі посилання), так і `{uuid}-{slug}` — id завжди перші 36 символів. */
export function parseListingIdParam(param: string): string {
  return param.slice(0, UUID_LENGTH);
}
