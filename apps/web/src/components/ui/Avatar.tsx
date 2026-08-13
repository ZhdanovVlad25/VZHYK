import { cn } from '@/lib/cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

export interface AvatarProps {
  name: string | null;
  size?: AvatarSize;
  className?: string;
}

/**
 * Немає флоу завантаження фото профілю (avatarMediaId у профілі є, але без UI —
 * docs/api.md), тож у кожного автора аватарка-заглушка з ініціалом імені замість
 * порожнього місця. Коли з'явиться завантаження фото — просто рендерити <img>
 * замість цього компонента, коли avatarUrl не null.
 */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700',
        sizeClasses[size],
        className,
      )}
    >
      {initial}
    </div>
  );
}
