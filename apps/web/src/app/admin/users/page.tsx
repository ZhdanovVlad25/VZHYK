'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, blockUser, searchAdminUsers, unblockUser, type AdminUserView } from '@/lib/api';
import { Badge, Button, EmptyState, Input, LoadingState } from '@/components/ui';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function AdminUsersPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminUserView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(
    async (query?: string) => {
      if (!accessToken) return;
      setIsLoading(true);
      setError(null);
      try {
        setItems(await searchAdminUsers(accessToken, query));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити користувачів.');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
  }, [accessToken, isAdmin, load]);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(search || undefined);
  }

  async function handleToggleBlock(item: AdminUserView) {
    if (!accessToken) return;
    setActingId(item.id);
    setError(null);
    try {
      const updated = item.status === 'blocked' ? await unblockUser(item.id, accessToken) : await blockUser(item.id, accessToken);
      setItems((prev) => prev.map((u) => (u.id === item.id ? updated : u)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося виконати дію.');
    } finally {
      setActingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700">Щоб побачити користувачів, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (!authLoading && user && !isAdmin) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700">Доступ лише для адміністраторів.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Користувачі</h1>

      <form onSubmit={handleSearchSubmit} className="mb-6 flex gap-2">
        <div className="flex-1">
          <Input
            label="Пошук за телефоном або email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="+380… або email"
          />
        </div>
        <Button type="submit" className="mt-6">
          Знайти
        </Button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження…" />
      ) : items.length === 0 ? (
        <EmptyState title="Нікого не знайдено" description="Спробуйте інший запит." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={item.status === 'blocked' ? 'danger' : 'success'}>{item.status}</Badge>
                    <Badge tone="neutral">{item.role}</Badge>
                  </div>
                  <Link href={`/admin/users/${item.id}`} className="font-medium text-gray-900 hover:underline">
                    {item.phone ?? item.email ?? item.id}
                  </Link>
                  <p className="text-xs text-gray-500">Зареєстрований {formatDate(item.createdAt)}</p>
                </div>
                <Button
                  size="sm"
                  variant={item.status === 'blocked' ? 'secondary' : 'danger'}
                  isLoading={actingId === item.id}
                  onClick={() => handleToggleBlock(item)}
                >
                  {item.status === 'blocked' ? 'Розблокувати' : 'Заблокувати'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
