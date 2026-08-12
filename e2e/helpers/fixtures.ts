const PHONE_PREFIXES = ['67', '68', '96', '97', '98', '50', '66', '95', '99'];

/** `@IsPhoneNumber('UA')` на бекенді валідує через libphonenumber-js — потрібні реальні мобільні префікси. */
export function uniquePhone(): string {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const suffix = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
  return `+380${prefix}${suffix}`;
}

export function uniqueTitle(base: string): string {
  return `${base} ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
