'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getAuditLog, type AuditLogEntry } from '@/lib/api';
import { Badge, Button, Dropdown, EmptyState, ErrorState, Input, LoadingState } from '@/components/ui';

const TARGET_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Усі типи' },
  { value: 'user', label: 'user' },
  { value: 'listing', label: 'listing' },
  { value: 'moderation_case', label: 'moderation_case' },
  { value: 'report', label: 'report' },
];

const ACTION_OPTIONS = [
  { value: 'ALL', label: 'Усі дії' },
  { value: 'user.block', label: 'user.block' },
  { value: 'user.unblock', label: 'user.unblock' },
  { value: 'listing.admin_update', label: 'listing.admin_update' },
  { value: 'moderation.decide', label: 'moderation.decide' },
  { value: 'report.resolve', label: 'report.resolve' },
];

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );
}

export default function AdminAuditLogPage() {
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const [items, setItems] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [targetType, setTargetType] = useState('ALL');
  const [action, setAction] = useState('ALL');
  const [actorUserId, setActorUserId] = useState('');

  const isAdmin = user?.role === 'admin';

  const load = useCallback(
    async (actorOverride?: string) => {
      if (!accessToken) return;
      setIsLoading(true);
      setError(null);
      try {
        setItems(
          await getAuditLog(accessToken, {
            targetType: targetType === 'ALL' ? undefined : targetType,
            action: action === 'ALL' ? undefined : action,
            actorUserId: actorOverride ?? (actorUserId || undefined),
          }),
        );
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити журнал дій.');
      } finally {
        setIsLoading(false);
      }
    },
    [accessToken, targetType, action, actorUserId],
  );

  useEffect(() => {
    if (accessToken && isAdmin) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isAdmin, targetType, action]);

  function handleActorSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    load(actorUserId || undefined);
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="mb-4 text-gray-700">Щоб побачити журнал дій, потрібно увійти.</p>
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
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Журнал дій</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Dropdown label="Тип цілі" options={TARGET_TYPE_OPTIONS} value={targetType} onChange={setTargetType} />
        </div>
        <div className="w-56">
          <Dropdown label="Дія" options={ACTION_OPTIONS} value={action} onChange={setAction} />
        </div>
        <form onSubmit={handleActorSearchSubmit} className="flex items-end gap-2">
          <div className="w-56">
            <Input
              label="ID автора дії"
              value={actorUserId}
              onChange={(e) => setActorUserId(e.target.value)}
              placeholder="uuid адміна/модератора"
            />
          </div>
          <Button type="submit" variant="secondary">
            Знайти
          </Button>
        </form>
      </div>

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="Журнал порожній" description="Мутуючі дії адмінів/модераторів з'являться тут." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Коли</th>
                <th className="px-3 py-2">Дія</th>
                <th className="px-3 py-2">Ціль</th>
                <th className="px-3 py-2">До / Після</th>
                <th className="px-3 py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-b border-gray-100 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-500">{formatDate(entry.createdAt)}</td>
                  <td className="px-3 py-2">
                    <Badge tone="info">{entry.action}</Badge>
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {entry.targetType}
                    {entry.targetId && <span className="text-gray-400"> · {entry.targetId.slice(0, 8)}</span>}
                  </td>
                  <td className="max-w-xs px-3 py-2 font-mono text-xs text-gray-600">
                    {entry.before && <div>− {JSON.stringify(entry.before)}</div>}
                    {entry.after && <div>+ {JSON.stringify(entry.after)}</div>}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{entry.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
