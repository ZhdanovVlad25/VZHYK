'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getPublicProfile, type PublicProfile } from '@/lib/api';
import { Avatar } from '@/components/ui';
import { cn } from '@/lib/cn';

/** Той самий поріг, що ONLINE_STALE_MS у jwt.strategy.ts — свіжіше за нього вважається "онлайн зараз". */
const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

// Intl.DateTimeFormat('uk-UA', {month:'long'}) віддає називний відмінок ("серпень"),
// а "На Вжику З ..." вимагає родового ("з серпня") — перевірено наживо на проді
// ("На Вжику з серпень 2026" — граматично невірно). Стандартного способу форсувати
// родовий БЕЗ дня в ICU/uk-UA нема, тож проста статична мапа на 12 місяців.
const MONTHS_GENITIVE = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
];

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return `${MONTHS_GENITIVE[date.getMonth()]} ${date.getFullYear()}`;
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

  const lastSeenLabel = profile.lastActiveAt ? formatLastSeen(profile.lastActiveAt) : null;
  const isOnline = lastSeenLabel === 'Онлайн';

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Секції рознесені окремими блоками (не один суцільний flex-wrap рядок) — раніше
          лінк "Інші оголошення автора" ділив рядок з іменем/бейджем і на вузьких екранах
          переносився впритул до "Телефон підтверджено", зливаючись в одну купу тексту. */}
      <div className="flex items-start gap-3">
        <Avatar name={profile.displayName} url={profile.avatarUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            На Вжику з {formatMemberSince(profile.memberSince)}
            {profile.activeListingsCount > 0 && ` · ${profile.activeListingsCount} оголошень`}
          </p>
          {lastSeenLabel && (
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span
                aria-hidden="true"
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600')}
              />
              {lastSeenLabel}
            </p>
          )}
        </div>
      </div>

      <Link
        href={`/search?seller=${sellerId}`}
        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-brand-100 bg-white px-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 dark:border-gray-700 dark:bg-gray-900 dark:text-brand-400 dark:hover:bg-gray-700"
      >
        Інші оголошення автора
        <span aria-hidden="true">→</span>
      </Link>

      <p className="flex items-start gap-1.5 border-t border-brand-100 pt-3 text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
        {/* Векторний щит замість emoji 🛡️ — той самий силует/помаранчевий градієнт, що на
            референсі користувача, без білого підкладу під ним (працює на будь-якому фоні картки). */}
        <svg viewBox="0 0 24 24" width="16" height="16" className="mt-0.5 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="sellerCardShieldGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="100%" stopColor="#C2410C" />
            </linearGradient>
          </defs>
          <path d="M12 1.5l8.5 3.2v5.7c0 5.4-3.6 10.2-8.5 11.6C7.1 20.6 3.5 15.8 3.5 10.4V4.7L12 1.5z" fill="url(#sellerCardShieldGrad)" />
          <path d="M12 1.5v20c4.9-1.4 8.5-6.2 8.5-11.6V4.7L12 1.5z" fill="#000" opacity="0.12" />
        </svg>
        <span>
          Спілкуйтесь у чаті платформи й не переказуйте передоплату наперед — це найчастіша
          причина шахрайства на дошках оголошень.
        </span>
      </p>
    </div>
  );
}
