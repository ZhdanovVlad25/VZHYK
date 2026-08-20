'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  getAdminReports,
  resolveReport,
  type Report,
  type ReportReason,
  type ReportResolutionStatus,
  type ReportStatus,
  type ReportTargetType,
} from '@/lib/api';
import { Badge, Button, Dropdown, EmptyState, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: 'Нова',
  REVIEWING: 'В обробці',
  RESOLVED: 'Вирішено',
  REJECTED: 'Відхилено',
};

const STATUS_TONES: Record<ReportStatus, BadgeTone> = {
  PENDING: 'warning',
  REVIEWING: 'info',
  RESOLVED: 'success',
  REJECTED: 'danger',
};

const REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Спам',
  FRAUD: 'Шахрайство',
  PROHIBITED_ITEM: 'Заборонений товар',
  OFFENSIVE_CONTENT: 'Образливий контент',
  DUPLICATE: 'Дублікат',
  OTHER: 'Інше',
};

const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  LISTING: 'Оголошення',
  USER: 'Користувач',
  CHAT: 'Чат',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі' },
  ...(Object.keys(STATUS_LABELS) as ReportStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] })),
];

const TARGET_TYPE_FILTER_OPTIONS = [
  { value: 'ALL', label: 'Усі типи' },
  ...(Object.keys(TARGET_TYPE_LABELS) as ReportTargetType[]).map((t) => ({ value: t, label: TARGET_TYPE_LABELS[t] })),
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export default function AdminReportsPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [status, setStatus] = useState('ALL');
  const [targetType, setTargetType] = useState('ALL');
  const [items, setItems] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const isModerator = user?.role === 'moderator' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminReports(
        accessToken,
        status === 'ALL' ? undefined : (status as ReportStatus),
        targetType === 'ALL' ? undefined : (targetType as ReportTargetType),
      );
      setItems(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити скарги.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, status, targetType]);

  useEffect(() => {
    if (accessToken && isModerator) {
      load();
    }
  }, [accessToken, isModerator, load]);

  async function handleResolve(reportId: string, next: ReportResolutionStatus) {
    if (!accessToken) return;
    setResolvingId(reportId);
    try {
      const updated = await resolveReport(reportId, next, accessToken);
      setItems((prev) => prev.map((item) => (item.id === reportId ? { ...item, ...updated } : item)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося зберегти рішення.');
    } finally {
      setResolvingId(null);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб побачити скарги, потрібно увійти.</p>
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Скарги</h1>
        <div className="flex gap-3">
          <div className="w-48">
            <Dropdown label="Статус" options={STATUS_FILTER_OPTIONS} value={status} onChange={setStatus} />
          </div>
          <div className="w-48">
            <Dropdown label="Тип цілі" options={TARGET_TYPE_FILTER_OPTIONS} value={targetType} onChange={setTargetType} />
          </div>
        </div>
      </div>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження скарг…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="Скарг не знайдено" description="Немає скарг за обраними фільтрами." />
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const isOpen = item.status === 'PENDING' || item.status === 'REVIEWING';
            return (
              <li key={item.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONES[item.status]}>{STATUS_LABELS[item.status]}</Badge>
                  <Badge tone="neutral">{REASON_LABELS[item.reason]}</Badge>
                  <span className="text-xs text-gray-500 dark:text-gray-400">Подано {formatDate(item.createdAt)}</span>
                </div>

                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {TARGET_TYPE_LABELS[item.targetType]}:{' '}
                  {item.targetType === 'LISTING' ? (
                    <Link href={`/listings/${item.targetId}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {item.targetId.slice(0, 8)}
                    </Link>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">{item.targetId.slice(0, 8)}</span>
                  )}
                </p>
                {item.description && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{item.description}</p>}

                {isOpen && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        isLoading={resolvingId === item.id}
                        onClick={() => handleResolve(item.id, 'REVIEWING')}
                      >
                        В обробці
                      </Button>
                    )}
                    <Button size="sm" isLoading={resolvingId === item.id} onClick={() => handleResolve(item.id, 'RESOLVED')}>
                      Вирішено
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      isLoading={resolvingId === item.id}
                      onClick={() => handleResolve(item.id, 'REJECTED')}
                    >
                      Відхилено
                    </Button>
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
