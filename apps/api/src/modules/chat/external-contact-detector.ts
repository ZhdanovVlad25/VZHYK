/**
 * Антифрод: шахраї часто намагаються вивести розмову з чату платформи в Telegram/Viber/
 * WhatsApp, де немає ні модерації, ні історії листування як доказу. Детектор — сигнал для
 * попередження користувача, НЕ блокування повідомлення (легітимні причини теж є, напр.
 * продавець-бізнес хоче надіслати каталог) — рішення явно за самим користувачем.
 */
const EXTERNAL_CONTACT_PATTERNS: RegExp[] = [
  /\bt\.me\//i,
  /telegram\.me\//i,
  /\btelegram\b/i,
  /\bтелеграм\b/i,
  /\bwa\.me\//i,
  /\bwhatsapp\b/i,
  /\bватсап\b/i,
  /\bviber\b/i,
  /\bвайбер\b/i,
];

export function containsExternalContactMention(text: string): boolean {
  return EXTERNAL_CONTACT_PATTERNS.some((pattern) => pattern.test(text));
}
