'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getMyListings, type Listing, type ListingStatus } from '@/lib/api';
import { Badge, Button, Dropdown, EmptyState, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';

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

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Ціна не вказана';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function MyListingsPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [status, setStatus] = useState('ALL');
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-center">
        <p className="mb-4 text-gray-600">Увійдіть, щоб побачити свої оголошення.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900">Мої оголошення</h1>
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
          {listings.map((listing) => (
            <li key={listing.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge tone={STATUS_TONES[listing.status]}>{STATUS_LABELS[listing.status]}</Badge>
                    <span className="text-xs text-gray-500">Створено {formatDate(listing.createdAt)}</span>
                  </div>
                  <p className="truncate font-medium text-gray-900">{listing.title}</p>
                  <p className="text-sm text-gray-600">
                    {formatPrice(listing.price, listing.currency)} · {listing.viewsCount} переглядів
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {listing.status === 'DRAFT' ? (
                    <Link href={`/listings/${listing.id}/edit`}>
                      <Button size="sm" variant="secondary">
                        Редагувати
                      </Button>
                    </Link>
                  ) : (
                    <Link href={`/listings/${listing.id}`}>
                      <Button size="sm" variant="secondary">
                        Переглянути
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
