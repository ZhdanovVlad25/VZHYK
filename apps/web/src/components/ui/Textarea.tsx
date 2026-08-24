import { TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * Той самий label/hint/error API, що й Input, але <textarea> замість <input> — для
 * довгого вільного тексту (опис оголошення), щоб він ріс вниз, а не гортався вбік.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, id, className, required, rows = 5, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && (
          <span className="text-accent-600 dark:text-accent-500" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        required={required}
        aria-describedby={cn(hintId, errorId) || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'resize-y rounded-xl border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
          'focus-visible:border-brand-600',
          'dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
          error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700',
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <span id={hintId} className="text-xs text-gray-500 dark:text-gray-400">
          {hint}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  );
});
