import { cn } from '@/lib/cn';
import type { SellerType } from '@/lib/api';

interface SellerTypeToggleProps {
  value: SellerType | null;
  onChange: (value: SellerType) => void;
  error?: string;
}

const OPTIONS: { value: SellerType; label: string }[] = [
  { value: 'private', label: 'Приватна особа' },
  { value: 'business', label: 'Бізнес' },
];

/** Обов'язковий вибір при створенні оголошення — статистика приватні/бізнес (docs/decisions.md). */
export function SellerTypeToggle({ value, onChange, error }: SellerTypeToggleProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Приватні чи бізнес
        <span className="text-accent-600 dark:text-accent-500" aria-hidden="true">
          {' '}
          *
        </span>
      </span>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Приватні чи бізнес">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-4 py-3 text-sm font-medium transition-colors',
              value === option.value
                ? 'border-brand-600 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-gray-800 dark:text-brand-400'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      {error && (
        <span role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
