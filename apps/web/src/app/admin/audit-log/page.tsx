'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getAuditLog, type AuditLogEntry } from '@/lib/api';
import { Badge, Button, EmptyState, ErrorState, LoadingState } from '@/components/ui';

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

  const isAdmin = user?.role === 'admin';

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setError(null);
    try {
      setItems(await getAuditLog(accessToken));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити журнал дій.');
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

      {authLoading || isLoading ? (
        <LoadingState label="Завантаження…" />
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="Журнал порожній" description="Мутуючі дії адмінів/модераторів з'являться тут." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
