'use client';

import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/language-context';
import type { Language } from '@/lib/i18n';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'uk', label: 'УКР' },
  { value: 'ru', label: 'РУС' },
];

/** УКР/РУС — сегментований перемикач поруч із темою в хедері. За замовчуванням завжди УКР (language-context.tsx). */
export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div role="radiogroup" aria-label="Мова інтерфейсу" className="flex shrink-0 rounded-full border border-gray-200 p-0.5 text-xs font-semibold dark:border-gray-700">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={language === option.value}
          onClick={() => setLanguage(option.value)}
          className={cn(
            'rounded-full px-2 py-1 transition-colors',
            language === option.value
              ? 'bg-brand-600 text-white'
              : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
