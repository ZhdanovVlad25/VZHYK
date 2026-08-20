import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type AlertTone = 'info' | 'success' | 'warning' | 'danger';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: AlertTone;
  title?: string;
}

const toneClasses: Record<AlertTone, string> = {
  info: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-900',
  success: 'bg-green-50 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-200 dark:border-green-900',
  warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900',
  danger: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900',
};

/**
 * role="alert" (danger/warning) читається screen reader'ом одразу; для info/success —
 * role="status" (менш нав'язливо). Зрозумілі повідомлення про помилки — decisions.md DEC-09.
 */
export function Alert({ tone = 'info', title, className, children, ...props }: AlertProps) {
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status';
  return (
    <div
      role={role}
      className={cn('rounded-xl border p-3 text-sm', toneClasses[tone], className)}
      {...props}
    >
      {title && <p className="font-medium">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
