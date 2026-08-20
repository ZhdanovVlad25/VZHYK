'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, createChat, sendChatMessage } from '@/lib/api';
import { Button } from '@/components/ui';
import { formatPrice } from '@/lib/format';

const DEFAULT_MIN_RATIO = 0.7;
// Авто/нерухомість — великі, зазвичай уже "твердо" оцінені суми; торг на третину ціни
// тут виглядає несерйозно (і те саме для доларових оголошень — валюта сама по собі
// сигналить вищий цінник/міжнародний товар, де запас на торг менший).
const NARROW_MIN_RATIO = 0.9;
const NARROW_RANGE_CATEGORIES = ['Авто', 'Нерухомість'];

export function PriceOfferButton({
  listingId,
  ownerId,
  price,
  currency,
  topCategoryName,
}: {
  listingId: string;
  ownerId: string;
  price: number;
  currency: string;
  topCategoryName?: string | null;
}) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const isNarrowRange =
    (topCategoryName && NARROW_RANGE_CATEGORIES.includes(topCategoryName)) || currency === 'USD';
  const min = Math.round(price * (isNarrowRange ? NARROW_MIN_RATIO : DEFAULT_MIN_RATIO));
  const [isOpen, setIsOpen] = useState(false);
  const [offer, setOffer] = useState(min);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === ownerId) {
    return null;
  }

  function handleToggle() {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setIsOpen((v) => !v);
  }

  async function handleSend() {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const chat = await createChat(ownerId, listingId, accessToken);
      await sendChatMessage(
        chat.id,
        `Пропоную ціну: ${formatPrice(offer, currency)} (замість ${formatPrice(price, currency)})`,
        accessToken,
      );
      router.push(`/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося надіслати пропозицію.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <Button size="sm" variant="secondary" onClick={handleToggle}>
        Хочу дешевше
      </Button>

      {isOpen && (
        <div className="mt-2 w-full max-w-xs rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
          <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-400">{formatPrice(offer, currency)}</p>
          <input
            type="range"
            min={min}
            max={price}
            value={offer}
            onChange={(e) => setOffer(Number(e.target.value))}
            className="w-full accent-brand-600"
            aria-label="Запропонована ціна"
          />
          <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{formatPrice(min, currency)}</span>
            <span>{formatPrice(price, currency)}</span>
          </div>
          <Button size="sm" className="mt-3 w-full" isLoading={isSubmitting} onClick={handleSend}>
            Надіслати пропозицію
          </Button>
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
