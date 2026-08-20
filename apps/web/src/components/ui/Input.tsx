import { InputHTMLAttributes, forwardRef, useId } from 'react';
import { cn } from '@/lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

/**
 * Input завжди з прив'язаним <label> (htmlFor/id), aria-describedby для hint/error,
 * aria-invalid при помилці — базова accessibility (decisions.md DEC-09).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, id, className, required, ...props },
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
      <input
        ref={ref}
        id={inputId}
        required={required}
        aria-describedby={cn(hintId, errorId) || undefined}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'h-10 rounded-xl border bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400',
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
