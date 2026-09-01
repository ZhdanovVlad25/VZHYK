'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getPublicProfile } from '@/lib/api';
import { Button } from '@/components/ui';

/**
 * В одному рядку з "Написати продавцю" (StartChatButton) — окремий невеликий фетч, той самий
 * патерн. MUST-аудит: раніше вимагав повного логіну (SMS-реєстрація) лише щоб показати
 * ЧУЖИЙ номер — покупець, який щойно знайшов товар, мусив спершу зареєструватись деінде,
 * хоча на OLX номер видно без входу. Бекенд (users.controller.ts) більше не гейтить телефон
 * авторизацією викликача — лишається лише вибір продавця (acceptsCalls).
 */
export function SellerPhoneButton({ sellerId }: { sellerId: string }) {
  const { user, accessToken } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === sellerId) {
    return null;
  }

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    try {
      const profile = await getPublicProfile(sellerId, accessToken ?? undefined);
      if (profile.phone) {
        setPhone(profile.phone);
      } else if (!profile.acceptsCalls) {
        setError('Продавець приймає лише повідомлення в чаті.');
      } else {
        setError('Продавець не показує номер телефону.');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося отримати номер телефону.');
    } finally {
      setIsLoading(false);
    }
  }

  if (phone) {
    return (
      <a
        href={`tel:${phone}`}
        // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: h-8=32px).
        className="inline-flex min-h-[44px] items-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400 dark:hover:bg-gray-700"
      >
        {phone}
      </a>
    );
  }

  return (
    <div>
      <Button size="sm" variant="secondary" isLoading={isLoading} onClick={handleClick}>
        Показати телефон
      </Button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
