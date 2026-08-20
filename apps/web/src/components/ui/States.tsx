import { ReactNode } from 'react';
import { Logo } from '../layout/Logo';
import { Button } from './Button';

/** aria-live="polite" + role="status": screen reader повідомляє про завантаження без переривання. */
export function LoadingState({ label = 'Завантаження…' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col items-center gap-2 py-6 text-gray-500 dark:text-gray-400">
      <Logo animated className="h-10 w-10" />
      <span>{label}</span>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      {icon && (
        <div className="text-gray-300" aria-hidden="true">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      {description && <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      {action && (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
}

/** role="alert" — помилка одразу оголошується screen reader'ом (decisions.md DEC-09). */
export function ErrorState({
  title = 'Щось пішло не так',
  description = 'Спробуйте оновити сторінку або повторити спробу пізніше.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-12 text-center">
      <h3 className="text-base font-semibold text-red-700 dark:text-red-400">{title}</h3>
      <p className="max-w-sm text-sm text-gray-500 dark:text-gray-400">{description}</p>
      {onRetry && (
        <Button className="mt-2" variant="secondary" onClick={onRetry}>
          Спробувати ще раз
        </Button>
      )}
    </div>
  );
}
