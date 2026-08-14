'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getFavorites, removeFavorite, type FavoriteView } from '@/lib/api';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import { formatPrice } from '@/lib/format';

export default function FavoritesPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      setFavorites(await getFavorites(accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити обране.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  async function handleRemove(listingId: string) {
    if (!accessToken) return;
    setRemovingId(listingId);
    try {
      await removeFavorite(listingId, accessToken);
      setFavorites((prev) => prev.filter((f) => f.listingId !== listingId));
    } finally {
      setRemovingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600">Увійдіть, щоб побачити обрані оголошення.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Обране</h1>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження обраного…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : favorites.length === 0 ? (
        <EmptyState title="Тут поки порожньо" description="Додавайте оголошення в обране, щоб швидко до них повертатись." />
      ) : (
        <ul className="flex flex-col gap-3">
          {favorites.map((fav) => (
            <li key={fav.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    {fav.isUnavailable && <Badge tone="danger">Недоступне</Badge>}
                    {!fav.isUnavailable && fav.priceChanged && <Badge tone="warning">Ціна змінилась</Badge>}
                  </div>
                  {fav.isUnavailable ? (
                    <p className="truncate font-medium text-gray-900">{fav.listing.title}</p>
                  ) : (
                    <Link
                      href={`/listings/${fav.listingId}`}
                      className="block truncate font-medium text-gray-900 hover:text-brand-700 hover:underline"
                    >
                      {fav.listing.title}
                    </Link>
                  )}
                  <p className="text-sm text-gray-600">{formatPrice(fav.listing.price, fav.listing.currency)}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {!fav.isUnavailable && (
                    <Link href={`/listings/${fav.listingId}`}>
                      <Button size="sm" variant="secondary">
                        Переглянути
                      </Button>
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    isLoading={removingId === fav.listingId}
                    onClick={() => handleRemove(fav.listingId)}
                  >
                    Прибрати
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
