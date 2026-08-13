'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPublicProfile, type PublicProfile } from '@/lib/api';
import { Avatar } from '@/components/ui';

/** Той самий поріг, що ONLINE_STALE_MS у jwt.strategy.ts — свіжіше за нього вважається "онлайн зараз". */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function formatLastSeen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < ONLINE_THRESHOLD_MS) return 'Онлайн';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `Був(ла) в мережі ${minutes} хв тому`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Був(ла) в мережі ${hours} год тому`;
  const days = Math.floor(hours / 24);
  return `Був(ла) в мережі ${days} дн тому`;
}

/**
 * Блок продавця під ціною/кнопками оголошення: аватарка, ім'я, останній візит,
 * лінк на інші оголошення. Показ телефону — окремий SellerPhoneButton в одному
 * рядку з "Написати продавцю" (той самий getPublicProfile, дублює невеликий
 * фетч, але тримає компоненти незалежними — той самий патерн, що FavoriteButton).
 */
export function SellerCard({ sellerId }: { sellerId: string }) {
  const { accessToken } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPublicProfile(sellerId, accessToken ?? undefined)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sellerId, accessToken]);

  if (!profile) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm">
      <Avatar name={profile.displayName} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900">{profile.displayName ?? 'Продавець'}</p>
        {profile.lastActiveAt && <p className="text-xs text-gray-500">{formatLastSeen(profile.lastActiveAt)}</p>}
      </div>
      <Link href={`/search?seller=${sellerId}`} className="text-sm font-medium text-brand-700 hover:underline">
        Інші оголошення автора
      </Link>
    </div>
  );
}
