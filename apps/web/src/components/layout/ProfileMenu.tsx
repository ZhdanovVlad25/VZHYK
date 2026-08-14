'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui';

const ITEMS = [
  { href: '/profile', label: 'Профіль' },
  { href: '/my-listings', label: 'Мої оголошення' },
  { href: '/chats', label: 'Повідомлення' },
  { href: '/favorites', label: 'Обране' },
  { href: '/saved-searches', label: 'Збережені пошуки' },
];

/** Все, що стосується акаунта, зібрано під одну кнопку — раніше 5+ окремих лінків у хедері разом з admin-навігацією переносились на другий рядок і виглядали захаращено. */
export function ProfileMenu() {
  const pathname = usePathname();
  const { user, displayName, avatarUrl, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  if (!user) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        <Avatar name={displayName} url={avatarUrl} size="sm" />
        <span className="max-w-[10rem] truncate">{displayName ?? user.phone}</span>
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg"
        >
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={displayName} url={avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{displayName ?? 'Ваш профіль'}</p>
              <p className="truncate text-xs text-gray-500">{user.phone}</p>
            </div>
          </div>

          <div className="my-2 border-t border-gray-100" />

          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm',
                pathname?.startsWith(item.href) ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-50',
              )}
            >
              {item.label}
            </Link>
          ))}

          <div className="my-2 border-t border-gray-100" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              logout();
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
          >
            Вийти
          </button>
        </div>
      )}
    </div>
  );
}
