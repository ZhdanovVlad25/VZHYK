'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, createReport, type ReportReason, type ReportTargetType } from '@/lib/api';
import { Button, Dropdown, Input } from '@/components/ui';

const REASON_OPTIONS: { value: ReportReason; label: string }[] = [
  { value: 'SPAM', label: 'Спам' },
  { value: 'FRAUD', label: 'Шахрайство' },
  { value: 'PROHIBITED_ITEM', label: 'Заборонений товар' },
  { value: 'OFFENSIVE_CONTENT', label: 'Образливий контент' },
  { value: 'DUPLICATE', label: 'Дублікат' },
  { value: 'OTHER', label: 'Інше' },
];

export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: string }) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  function handleOpen() {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setIsOpen(true);
  }

  async function handleSubmit() {
    if (!accessToken || !reason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await createReport({ targetType, targetId, reason, description: description || undefined }, accessToken);
      setIsSent(true);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати скаргу.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return <p className="text-xs text-gray-500">Скаргу надіслано, дякуємо</p>;
  }

  if (!isOpen) {
    return (
      <Button size="sm" variant="ghost" onClick={handleOpen}>
        Поскаржитися
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
      <Dropdown
        label="Причина скарги"
        options={REASON_OPTIONS}
        value={reason}
        onChange={(v) => setReason(v as ReportReason)}
        placeholder="Оберіть причину"
      />
      <Input
        label="Коментар"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        hint="Необов'язково"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" isLoading={isSubmitting} disabled={!reason} onClick={handleSubmit}>
          Надіслати
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsOpen(false)}>
          Скасувати
        </Button>
      </div>
    </div>
  );
}
