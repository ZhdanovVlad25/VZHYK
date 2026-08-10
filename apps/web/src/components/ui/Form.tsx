import { FormHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Заголовок форми, візуально прихований, але доступний для screen readers, якщо form стоїть окремо. */
  ariaLabel?: string;
}

/** Базовий form-wrapper з noValidate (валідація на боці застосунку, повідомлення — через Input error). */
export function Form({ className, ariaLabel, children, ...props }: FormProps) {
  return (
    <form
      noValidate
      aria-label={ariaLabel}
      className={cn('flex flex-col gap-4', className)}
      {...props}
    >
      {children}
    </form>
  );
}
