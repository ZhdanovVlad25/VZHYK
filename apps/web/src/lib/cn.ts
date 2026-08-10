/** Мінімальний className merger (без залежності від clsx/tailwind-merge для Phase 1). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
