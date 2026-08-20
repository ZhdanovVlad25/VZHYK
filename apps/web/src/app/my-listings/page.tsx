'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, deleteListing, getMyListings, listingDetailHref, type Listing, type ListingStatus } from '@/lib/api';
import { Badge, Button, Dropdown, EmptyState, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: 'Чернетка',
  PENDING_MODERATION: 'На модерації',
  ACTIVE: 'Активне',
  REJECTED: 'Відхилено',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано',
  EXPIRED: 'Термін минув',
  ARCHIVED: 'В архіві',
  BLOCKED: 'Заблоковано',
};

const STATUS_TONES: Record<ListingStatus, BadgeTone> = {
  DRAFT: 'neutral',
  PENDING_MODERATION: 'warning',
  ACTIVE: 'success',
  REJECTED: 'danger',
  RESERVED: 'info',
  SOLD: 'neutral',
  EXPIRED: 'neutral',
  ARCHIVED: 'neutral',
  BLOCKED: 'danger',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі статуси' },
  ...(Object.keys(STATUS_LABELS) as ListingStatus[]).map((status) => ({ value: status, label: STATUS_LABELS[status] })),
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function MyListingsPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [status, setStatus] = useState('ALL');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMyListings(accessToken, status === 'ALL' ? undefined : (status as ListingStatus));
      setListings(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити ваші оголошення.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  async function handleDelete(listing: Listing) {
    if (!accessToken) return;
    if (!window.confirm(`Видалити оголошення «${listing.title}»? Це незворотно.`)) return;
    setDeletingId(listing.id);
    setError(null);
    try {
      await deleteListing(listing.id, accessToken);
      setListings((prev) => prev.filter((l) => l.id !== listing.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося видалити оголошення.');
    } finally {
      setDeletingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600 dark:text-gray-400">Увійдіть, щоб побачити свої оголошення.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Мої оголошення</h1>
        <div className="w-56">
          <Dropdown label="Статус" options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
        </div>
      </div>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження оголошень…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : listings.length === 0 ? (
        <EmptyState
          title="Оголошень не знайдено"
          description={status === 'ALL' ? 'Ви ще не створювали оголошень.' : 'У цьому статусі немає оголошень.'}
          action={{ label: '+ Додати оголошення', onClick: () => (window.location.href = '/listings/new') }}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {listings.map((listing) => {
            const href = listingDetailHref(listing);
            return (
              <li key={listing.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <Badge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">Створено {formatDate(listing.createdAt)}</span>
                    </div>
                    <Link href={href} className="block truncate font-medium text-gray-900 hover:text-brand-700 hover:underline dark:text-gray-100 dark:hover:text-brand-400">
                      {listing.title}
                    </Link>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatPrice(listing.price, listing.currency)} · {listing.viewsCount} переглядів
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Link href={href}>
                      <Button size="sm" variant="secondary">
                        {listing.status === 'DRAFT' ? 'Редагувати' : 'Переглянути'}
                      </Button>
                    </Link>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={deletingId === listing.id}
                      onClick={() => handleDelete(listing)}
                    >
                      Видалити
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
