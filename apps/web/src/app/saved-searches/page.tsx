'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, deleteSavedSearch, getCategoryTree, getSavedSearches, type Category, type SavedSearch } from '@/lib/api';
import { Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';

function flattenCategoryLabels(categories: Category[], prefix = ''): Map<string, string> {
  const map = new Map<string, string>();
  for (const c of categories) {
    const label = prefix ? `${prefix} → ${c.nameUk}` : c.nameUk;
    map.set(c.id, label);
    for (const [id, childLabel] of flattenCategoryLabels(c.children, label)) {
      map.set(id, childLabel);
    }
  }
  return map;
}

function searchHref(item: SavedSearch): string {
  const params = new URLSearchParams();
  if (item.queryText) params.set('q', item.queryText);
  if (item.categoryId) params.set('category', item.categoryId);
  return `/search${params.toString() ? `?${params.toString()}` : ''}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function SavedSearchesPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [categoryLabels, setCategoryLabels] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const [items, categories] = await Promise.all([getSavedSearches(accessToken), getCategoryTree()]);
      setSavedSearches(items);
      setCategoryLabels(flattenCategoryLabels(categories));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити збережені пошуки.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  async function handleRemove(id: string) {
    if (!accessToken) return;
    setRemovingId(id);
    try {
      await deleteSavedSearch(id, accessToken);
      setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setRemovingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600">Увійдіть, щоб побачити збережені пошуки.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Збережені пошуки</h1>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : savedSearches.length === 0 ? (
        <EmptyState
          title="Збережених пошуків немає"
          description="На сторінці пошуку натисніть «Зберегти пошук», щоб швидко повертатись до нього."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {savedSearches.map((item) => (
            <li key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">
                    {item.queryText ? `«${item.queryText}»` : 'Усі оголошення'}
                    {item.categoryId && (
                      <span className="font-normal text-gray-600"> · {categoryLabels.get(item.categoryId) ?? 'Категорія'}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">Збережено {formatDate(item.createdAt)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={searchHref(item)}>
                    <Button size="sm" variant="secondary">
                      Знайти
                    </Button>
                  </Link>
                  <Button size="sm" variant="ghost" isLoading={removingId === item.id} onClick={() => handleRemove(item.id)}>
                    Видалити
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
