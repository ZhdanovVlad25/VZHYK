'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getPublicProfile } from '@/lib/api';
import { Button } from '@/components/ui';

/** В одному рядку з "Написати продавцю" (StartChatButton) — окремий невеликий фетч, той самий патерн. */
export function SellerPhoneButton({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === sellerId) {
    return null;
  }

  async function handleClick() {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const profile = await getPublicProfile(sellerId, accessToken);
      if (profile.phone) {
        setPhone(profile.phone);
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
        className="inline-flex h-8 items-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100"
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
