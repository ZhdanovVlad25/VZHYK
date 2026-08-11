'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { search, createSavedSearch, ApiError, type SearchResultItem, type SearchParams } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ListingCard } from '@/components/listings/ListingCard';
import { Button, Dropdown, EmptyState, ErrorState, LoadingState } from '@/components/ui';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Спочатку нові' },
  { value: 'relevance', label: 'За релевантністю' },
  { value: 'price_asc', label: 'Дешевші спочатку' },
  { value: 'price_desc', label: 'Дорожчі спочатку' },
];

/** useSearchParams() вимагає Suspense-межу в App Router, інакше build падає на prerender. */
export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState label="Завантаження…" />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const urlParams = useSearchParams();
  const q = urlParams.get('q') ?? '';
  const category = urlParams.get('category') ?? undefined;
  const { user, accessToken } = useAuth();

  const [sort, setSort] = useState<SearchParams['sort']>(q ? 'relevance' : 'newest');
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSearchMessage, setSaveSearchMessage] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await search({ q: q || undefined, category, sort });
      setItems(result.items);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити результати пошуку.');
    } finally {
      setIsLoading(false);
    }
  }, [q, category, sort]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const result = await search({ q: q || undefined, category, sort, cursor: nextCursor });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити ще оголошення.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function saveSearch() {
    if (!accessToken) return;
    setIsSavingSearch(true);
    setSaveSearchMessage(null);
    try {
      await createSavedSearch({ queryText: q || undefined, categoryId: category, filters: sort ? { sort } : undefined }, accessToken);
      setSaveSearchMessage('Пошук збережено');
    } catch (err) {
      setSaveSearchMessage(err instanceof ApiError ? err.message : 'Не вдалося зберегти пошук.');
    } finally {
      setIsSavingSearch(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">
          {q ? (
            <>
              Результати пошуку: <span className="text-brand-600">«{q}»</span>
            </>
          ) : (
            'Усі оголошення'
          )}
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          {user && (q || category) && (
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" size="sm" isLoading={isSavingSearch} onClick={saveSearch}>
                Зберегти пошук
              </Button>
              {saveSearchMessage && <span className="text-xs text-gray-500">{saveSearchMessage}</span>}
            </div>
          )}
          <div className="w-56">
            <Dropdown
              label="Сортування"
              options={SORT_OPTIONS}
              value={sort ?? 'newest'}
              onChange={(value) => setSort(value as SearchParams['sort'])}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Шукаємо оголошення…" />
      ) : error ? (
        <ErrorState description={error} onRetry={runSearch} />
      ) : items.length === 0 ? (
        <EmptyState title="Нічого не знайдено" description="Спробуйте змінити запит або фільтри." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" isLoading={isLoadingMore} onClick={loadMore}>
                Завантажити ще
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
