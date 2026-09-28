'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getDashboardMetrics, type DashboardMetrics, type ListingStatus } from '@/lib/api';
import { Badge, Button, Card, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';

const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
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

const LISTING_STATUS_TONES: Record<ListingStatus, BadgeTone> = {
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

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getDashboardMetrics(accessToken);
      setMetrics(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити метрики.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
  }, [accessToken, isAdmin, load]);

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700 dark:text-gray-300">Щоб побачити дашборд, потрібно увійти.</p>
        <Link href="/login">
          <Button>Увійти</Button>
        </Link>
      </div>
    );
  }

  if (!authLoading && user && !isAdmin) {
    return <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700 dark:text-gray-300">Доступ лише для адміністраторів.</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-gray-900 dark:text-gray-100">Дашборд</h1>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження метрик…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : metrics ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Користувачі</h2>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.users.total}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="success">Активні: {metrics.users.active}</Badge>
              <Badge tone="danger">Заблоковані: {metrics.users.blocked}</Badge>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Оголошення</h2>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.listings.total}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(Object.keys(metrics.listings.byStatus) as ListingStatus[])
                .filter((status) => metrics.listings.byStatus[status] > 0)
                .map((status) => (
                  <Badge key={status} tone={LISTING_STATUS_TONES[status]}>
                    {LISTING_STATUS_LABELS[status]}: {metrics.listings.byStatus[status]}
                  </Badge>
                ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="neutral">Приватні: {metrics.listings.bySellerType.private}</Badge>
              <Badge tone="info">Бізнес: {metrics.listings.bySellerType.business}</Badge>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Модерація</h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">Очікує: {metrics.moderation.pending}</Badge>
              <Badge tone="danger">Потребує уваги: {metrics.moderation.needsReview}</Badge>
            </div>
            <Link href="/admin/moderation" className="mt-3 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              Перейти до черги →
            </Link>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Скарги</h2>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warning">Нові: {metrics.reports.pending}</Badge>
              <Badge tone="info">В обробці: {metrics.reports.reviewing}</Badge>
            </div>
            <Link href="/admin/reports" className="mt-3 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400">
              Перейти до скарг →
            </Link>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Anti-fraud</h2>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.riskFlaggedUsers}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">користувачів з risk score понад поріг</p>
          </Card>

          <Card>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Відвідування сайту</h2>
            {metrics.traffic ? (
              <>
                <div className="flex gap-6">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.traffic.last7Days.visitors}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">відвідувачів за 7 днів</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{metrics.traffic.last30Days.visitors}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">за 30 днів</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge tone="neutral">Перегляди (7д): {metrics.traffic.last7Days.pageviews}</Badge>
                  <Badge tone="neutral">Візити (7д): {metrics.traffic.last7Days.visits}</Badge>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Статистика тимчасово недоступна.</p>
            )}
            {/* Детальні розрізи (сторінки, джерела переходів, пристрої) — власний UI Umami,
                не дублюємо тут; лінк відкриває той самий self-hosted дашборд напряму. */}
            <a
              href="https://umami-production-5cee.up.railway.app"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
            >
              Детальна статистика (сторінки, джерела) →
            </a>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
