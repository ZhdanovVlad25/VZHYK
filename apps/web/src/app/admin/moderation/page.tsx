'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  decideModerationCase,
  getModerationQueue,
  listingDetailHref,
  type ModerationCaseStatus,
  type ModerationDecision,
  type ModerationQueueItem,
} from '@/lib/api';
import { Badge, Button, Dropdown, EmptyState, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<ModerationCaseStatus, string> = {
  PENDING: 'Очікує',
  NEEDS_REVIEW: 'Потребує уваги',
  APPROVED: 'Схвалено',
  REJECTED: 'Відхилено',
};

const STATUS_TONES: Record<ModerationCaseStatus, BadgeTone> = {
  PENDING: 'neutral',
  NEEDS_REVIEW: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі' },
  ...(Object.keys(STATUS_LABELS) as ModerationCaseStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export default function ModerationQueuePage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [status, setStatus] = useState('ALL');
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const isModerator = user?.role === 'moderator' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getModerationQueue(accessToken, status === 'ALL' ? undefined : (status as ModerationCaseStatus));
      setItems(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити чергу модерації.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => {
    if (accessToken && isModerator) {
      load();
    }
  }, [accessToken, isModerator, load]);

  async function handleDecide(caseId: string, decision: ModerationDecision) {
    if (!accessToken) return;
    setDecidingId(caseId);
    try {
      const updated = await decideModerationCase(caseId, decision, accessToken);
      setItems((prev) => prev.map((item) => (item.id === caseId ? { ...item, ...updated } : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти рішення.');
    } finally {
      setDecidingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб побачити чергу модерації, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (!authLoading && user && !isModerator) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700 dark:text-gray-300">
        Доступ лише для модераторів та адміністраторів.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Черга модерації</h1>
        <div className="w-56">
          <Dropdown label="Статус" options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
        </div>
      </div>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження черги…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="Черга порожня" description="Немає справ у цьому статусі." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isOpen = item.status === 'PENDING' || item.status === 'NEEDS_REVIEW';
            return (
              <li key={item.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                  {item.autoFlagReason && <Badge tone="danger">Авто-флаг: {item.autoFlagReason}</Badge>}
                  <span className="text-xs text-gray-500 dark:text-gray-400">Подано {formatDate(item.createdAt)}</span>
                </div>

                {item.listing ? (
                  <div className="flex gap-3">
                    {item.listing.mainMediaUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL, коротко живе (не варто next/image кешу)
                      <img
                        src={item.listing.mainMediaUrl}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                      />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-[11px] text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500">
                        Без фото
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={listingDetailHref(item.listing)} className="font-medium text-gray-900 hover:underline dark:text-gray-100">
                          {item.listing.title}
                        </Link>
                        {item.listing.ownerRiskScore > 0 && (
                          <Badge tone={item.listing.ownerRiskScore >= 15 ? 'danger' : 'warning'}>
                            Risk score: {item.listing.ownerRiskScore}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{formatPrice(item.listing.price, item.listing.currency)}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500">Оголошення видалено</p>
                )}

                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      isLoading={decidingId === item.id}
                      onClick={() => handleDecide(item.id, 'APPROVED')}
                    >
                      Схвалити
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={decidingId === item.id}
                      onClick={() => handleDecide(item.id, 'REJECTED')}
                    >
                      Відхилити
                    </Button>
                    {item.status !== 'NEEDS_REVIEW' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={decidingId === item.id}
                        onClick={() => handleDecide(item.id, 'NEEDS_REVIEW')}
                      >
                        Потребує уваги
                      </Button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
