'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

export type AvatarSize = 'sm' | 'md' | 'lg';

const sizeClasses: Record<AvatarSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
};

export interface AvatarProps {
  name: string | null;
  /** Підписаний URL фото профілю (profiles.service.ts getUrlById) — null/undefined показує заглушку-силует. */
  url?: string | null;
  size?: AvatarSize;
  className?: string;
}

/** Фото профілю, якщо є (`url`), інакше нейтральна сіра заглушка-силует (голова+плечі) — без кольору/ініціалів, щоб не виглядало як реальний контакт. */
export function Avatar({ url, size = 'md', className }: AvatarProps) {
  // Підписаний URL міг протухнути або вказувати на видалений файл — без цього браузер
  // замість заглушки-силуету показував би власну іконку "зламане зображення".
  const [failed, setFailed] = useState(false);

  // Новий URL (напр. після повторного завантаження фото) заслуговує нової спроби.
  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL, той самий патерн, що фото оголошень
      <img
        src={url}
        alt=""
        aria-hidden="true"
        onError={() => setFailed(true)}
        className={cn('shrink-0 rounded-full object-cover', sizeClasses[size], className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
        sizeClasses[size],
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[85%] w-[85%] translate-y-[10%]">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22c0-5 3.6-9 8-9s8 4 8 9" />
      </svg>
    </div>
  );
}
