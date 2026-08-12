'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';

export function Header() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [q, setQ] = useState('');

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold text-brand-700">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-highlight-400 text-sm font-extrabold text-highlight-900"
            aria-hidden="true"
          >
            В
          </span>
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
          {isLoading ? null : user ? (
            <>
              <Link href="/listings/new">
                <Button variant="accent" size="sm">
                  + Додати оголошення
                </Button>
              </Link>
              <Link href="/my-listings" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Мої оголошення
              </Link>
              <Link href="/chats" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Повідомлення
              </Link>
              <Link href="/favorites" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Обране
              </Link>
              <Link href="/saved-searches" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Збережені пошуки
              </Link>
              {(user.role === 'moderator' || user.role === 'admin') && (
                <>
                  <Link href="/admin/moderation" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Модерація
                  </Link>
                  <Link href="/admin/reports" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Скарги
                  </Link>
                </>
              )}
              {user.role === 'admin' && (
                <>
                  <Link href="/admin/dashboard" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Дашборд
                  </Link>
                  <Link href="/admin/listings" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Оголошення (адмін)
                  </Link>
                  <Link href="/admin/categories" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Категорії
                  </Link>
                  <Link href="/admin/users" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Користувачі
                  </Link>
                  <Link href="/admin/audit-log" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                    Журнал дій
                  </Link>
                </>
              )}
              <span className="text-sm text-gray-600">{user.phone}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                Вийти
              </Button>
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
