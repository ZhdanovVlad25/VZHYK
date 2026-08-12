import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardProps = HTMLAttributes<HTMLDivElement>;

/** Базова картка-контейнер (оголошення, профіль, admin-панелі тощо). */
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div
      className={cn('rounded-2xl border border-gray-200 bg-white p-4 shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  );
}
