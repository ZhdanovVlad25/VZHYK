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
        <Link href="/" className="text-xl font-bold text-brand-600">
          ВЖИК
        </Link>

        <form onSubmit={handleSearch} role="search" className="flex min-w-[200px] flex-1 gap-2">
          <label htmlFor="header-search" className="sr-only">
            Пошук оголошень
          </label>
          <input
            id="header-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Що шукаєте?"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus-visible:outline-none"
          />
          <Button type="submit" size="sm">
            Знайти
          </Button>
        </form>

        <nav className="flex items-center gap-3">
          {isLoading ? null : user ? (
            <>
              <Link href="/listings/new">
                <Button size="sm">+ Додати оголошення</Button>
              </Link>
              <Link href="/my-listings" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Мої оголошення
              </Link>
              <Link href="/favorites" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Обране
              </Link>
              <Link href="/saved-searches" className="text-sm font-medium text-gray-700 hover:text-brand-600">
                Збережені пошуки
              </Link>
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
