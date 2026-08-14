'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { Logo } from './Logo';
import { ProfileMenu } from './ProfileMenu';

const navLinkClass = (isActive: boolean) =>
  cn(
    'rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-100 text-brand-700' : 'text-gray-700 hover:bg-gray-100 hover:text-brand-600',
  );

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [q, setQ] = useState('');

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold text-brand-700">
          <Logo className="h-7 w-7" />
          Вжик
        </Link>

        <form onSubmit={handleSearch} role="search" className="flex min-w-[200px] flex-1 items-center gap-2">
          <label htmlFor="header-search" className="sr-only">
            Пошук оголошень
          </label>
          <input
            id="header-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Що шукаєте?"
            className="h-8 w-full rounded-xl border border-gray-300 px-3 text-sm focus-visible:outline-none"
          />
          <Button type="submit" size="sm">
            Знайти
          </Button>
        </form>

        <nav className="flex items-center gap-3">
          {/* Завжди видима, навіть анонімним — /listings/new сама показує "увійдіть" з лінком на /login, якщо юзера нема. */}
          <Link href="/listings/new">
            <Button variant="accent" size="sm">
              + Додати оголошення
            </Button>
          </Link>
          {isLoading ? null : user ? (
            <>
              {(user.role === 'moderator' || user.role === 'admin') && (
                <>
                  <Link href="/admin/moderation" className={navLinkClass(pathname?.startsWith('/admin/moderation') ?? false)}>
                    Модерація
                  </Link>
                  <Link href="/admin/reports" className={navLinkClass(pathname?.startsWith('/admin/reports') ?? false)}>
                    Скарги
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <>
                  <Link href="/admin/dashboard" className={navLinkClass(pathname?.startsWith('/admin/dashboard') ?? false)}>
                    Дашборд
                  </Link>
                  <Link href="/admin/listings" className={navLinkClass(pathname?.startsWith('/admin/listings') ?? false)}>
                    Оголошення (адмін)
                  </Link>
                  <Link href="/admin/categories" className={navLinkClass(pathname?.startsWith('/admin/categories') ?? false)}>
                    Категорії
                  </Link>
                  <Link href="/admin/users" className={navLinkClass(pathname?.startsWith('/admin/users') ?? false)}>
                    Користувачі
                  </Link>
                  <Link href="/admin/audit-log" className={navLinkClass(pathname?.startsWith('/admin/audit-log') ?? false)}>
                    Журнал дій
                  </Link>
                </>
              )}
              <ProfileMenu />
            </>
          ) : (
            <Link href="/login">
              <Button variant="secondary" size="sm">
                Увійти
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
