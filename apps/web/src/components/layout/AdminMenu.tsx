'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { useLanguage } from '@/lib/language-context';
import type { TranslationKey } from '@/lib/i18n';

const MODERATOR_ITEMS: { href: string; labelKey: TranslationKey }[] = [
  { href: '/admin/moderation', labelKey: 'moderation' },
  { href: '/admin/reports', labelKey: 'reports' },
];

const ADMIN_ONLY_ITEMS: { href: string; labelKey: TranslationKey }[] = [
  { href: '/admin/dashboard', labelKey: 'dashboard' },
  { href: '/admin/listings', labelKey: 'adminListings' },
  { href: '/admin/categories', labelKey: 'categories' },
  { href: '/admin/users', labelKey: 'users' },
  { href: '/admin/audit-log', labelKey: 'auditLog' },
];

/**
 * 7 окремих лінків модерації/адміна в один нерозривний ряд хедера ламали лейаут
 * навіть на десктопі (наїжджали одне на одного) — тепер один випадаючий пункт,
 * той самий click-outside/Escape патерн, що й ProfileMenu.
 */
export function AdminMenu({ role }: { role: string }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = role === 'admin' ? [...MODERATOR_ITEMS, ...ADMIN_ONLY_ITEMS] : MODERATOR_ITEMS;

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

  const isActive = items.some((item) => pathname?.startsWith(item.href));

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className={cn(
          'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
            : 'text-gray-700 hover:bg-gray-100 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-brand-400',
        )}
      >
        {t('admin')} ▾
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm',
                pathname?.startsWith(item.href)
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                  : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
