'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPublicProfile, type PublicProfile } from '@/lib/api';
import { Avatar } from '@/components/ui';

/** Той самий поріг, що ONLINE_STALE_MS у jwt.strategy.ts — свіжіше за нього вважається "онлайн зараз". */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

function formatMemberSince(iso: string): string {
  return new Intl.DateTimeFormat('uk-UA', { month: 'long', year: 'numeric' }).format(new Date(iso));
}

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
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex flex-wrap items-center gap-3">
        <Avatar name={profile.displayName} url={profile.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-medium text-gray-900 dark:text-gray-100">{profile.displayName ?? 'Продавець'}</p>
            {/* Аудит 27.08 "шар довіри" — жодного сигналу надійності на картці оголошення.
                Кожен телефон на платформі верифікований через OTP при прив'язці, тож сам факт
                наявності вже й означає "підтверджено" (auth.service.ts). */}
            {profile.phoneVerified && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-200">
                <svg viewBox="0 0 20 20" width="12" height="12" fill="currentColor" aria-hidden="true">
                  <path d="M10 1.5l7 3.1v4.4c0 4.6-3 8.8-7 9.9-4-1.1-7-5.3-7-9.9V4.6l7-3.1z" opacity="0.3" />
                  <path fillRule="evenodd" d="M13.7 7.7a1 1 0 010 1.4l-4 4a1 1 0 01-1.4 0l-2-2a1 1 0 111.4-1.4l1.3 1.3 3.3-3.3a1 1 0 011.4 0z" clipRule="evenodd" />
                </svg>
                Телефон підтверджено
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            На Вжику з {formatMemberSince(profile.memberSince)}
            {profile.activeListingsCount > 0 && ` · ${profile.activeListingsCount} оголошень`}
          </p>
          {profile.lastActiveAt && <p className="text-xs text-gray-500 dark:text-gray-400">{formatLastSeen(profile.lastActiveAt)}</p>}
        </div>
        <Link href={`/search?seller=${sellerId}`} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400">
          Інші оголошення автора
        </Link>
      </div>
      <p className="border-t border-brand-100 pt-2 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        🛡️ Спілкуйтесь у чаті платформи й не переказуйте передоплату наперед — це найчастіша
        причина шахрайства на дошках оголошень.
      </p>
    </div>
  );
}
