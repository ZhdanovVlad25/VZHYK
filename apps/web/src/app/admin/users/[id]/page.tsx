'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  ApiError,
  blockUser,
  getAdminUserDetail,
  unblockUser,
  type AdminUserDetail,
  type ListingStatus,
  type ReportReason,
  type ReportStatus,
} from '@/lib/api';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, type BadgeTone } from '@/components/ui';
import { formatPrice } from '@/lib/format';

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

const REPORT_STATUS_TONES: Record<ReportStatus, BadgeTone> = {
  PENDING: 'warning',
  REVIEWING: 'info',
  RESOLVED: 'success',
  REJECTED: 'danger',
};

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SPAM: 'Спам',
  FRAUD: 'Шахрайство',
  PROHIBITED_ITEM: 'Заборонений товар',
  OFFENSIVE_CONTENT: 'Образливий контент',
  DUPLICATE: 'Дублікат',
  OTHER: 'Інше',
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params.id;
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getAdminUserDetail(userId, accessToken);
      setDetail(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити користувача.');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, userId]);

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
  }, [accessToken, isAdmin, load]);

  async function handleToggleBlock() {
    if (!accessToken || !detail) return;
    setIsActing(true);
    try {
      const updated = detail.status === 'blocked' ? await unblockUser(detail.id, accessToken) : await blockUser(detail.id, accessToken);
      setDetail((prev) => (prev ? { ...prev, ...updated } : prev));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося виконати дію.');
    } finally {
      setIsActing(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700">Щоб побачити користувача, потрібно увійти.</p>
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
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin/users" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← До списку користувачів
      </Link>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : detail ? (
        <div className="flex flex-col gap-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={detail.status === 'blocked' ? 'danger' : 'success'}>{detail.status}</Badge>
                  <Badge tone="neutral">{detail.role}</Badge>
                  {detail.riskScore > 0 && (
                    <Badge tone={detail.riskScore >= 15 ? 'danger' : 'warning'}>Risk score: {detail.riskScore}</Badge>
                  )}
                </div>
                <p className="text-lg font-semibold text-gray-900">{detail.phone ?? detail.email ?? detail.id}</p>
                {detail.profile.displayName && <p className="text-sm text-gray-600">{detail.profile.displayName}</p>}
                <p className="mt-1 text-xs text-gray-500">Зареєстрований {formatDate(detail.createdAt)}</p>
              </div>
              <Button
                variant={detail.status === 'blocked' ? 'secondary' : 'danger'}
                isLoading={isActing}
                onClick={handleToggleBlock}
              >
                {detail.status === 'blocked' ? 'Розблокувати' : 'Заблокувати'}
              </Button>
            </div>
          </Card>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Оголошення ({detail.listings.length})
            </h2>
            {detail.listings.length === 0 ? (
              <EmptyState title="Немає оголошень" />
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.listings.map((listing) => (
                  <li key={listing.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={LISTING_STATUS_TONES[listing.status]}>{LISTING_STATUS_LABELS[listing.status]}</Badge>
                      <Link href={`/listings/${listing.id}`} className="font-medium text-gray-900 hover:underline">
                        {listing.title}
                      </Link>
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatPrice(listing.price, listing.currency)} · {formatDate(listing.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Скарги ({detail.reports.length})
            </h2>
            {detail.reports.length === 0 ? (
              <EmptyState title="Скарг немає" />
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.reports.map((report) => (
                  <li key={report.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={REPORT_STATUS_TONES[report.status]}>{report.status}</Badge>
                      <Badge tone="neutral">{REPORT_REASON_LABELS[report.reason]}</Badge>
                      <span className="text-xs text-gray-500">{formatDate(report.createdAt)}</span>
                    </div>
                    {report.targetType === 'LISTING' && (
                      <Link href={`/listings/${report.targetId}`} className="text-sm text-brand-600 hover:underline">
                        Оголошення {report.targetId.slice(0, 8)}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Risk-сигнали ({detail.riskSignals.length})
            </h2>
            {detail.riskSignals.length === 0 ? (
              <EmptyState title="Сигналів немає" />
            ) : (
              <ul className="flex flex-col gap-2">
                {detail.riskSignals.map((signal) => (
                  <li key={signal.id} className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="warning">{signal.signalType}</Badge>
                      <span className="text-sm text-gray-600">вага {signal.weight}</span>
                      <span className="text-xs text-gray-500">{formatDate(signal.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
