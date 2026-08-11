'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { addFavorite, getFavorites, removeFavorite } from '@/lib/api';
import { Button } from '@/components/ui';

/** Немає ендпоінта "чи в обраному один listing" — стан вичитується зі списку GET /favorites. */
export function FavoriteButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [isFavorite, setIsFavorite] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      setIsFavorite(null);
      return;
    }
    let cancelled = false;
    getFavorites(accessToken)
      .then((favorites) => {
        if (!cancelled) setIsFavorite(favorites.some((f) => f.listingId === listingId));
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, listingId]);

  async function toggle() {
    if (!user || !accessToken) {
      router.push('/login');
      return;
    }
    setIsSubmitting(true);
    try {
      if (isFavorite) {
        await removeFavorite(listingId, accessToken);
        setIsFavorite(false);
      } else {
        await addFavorite(listingId, accessToken);
        setIsFavorite(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCheckingStatus = Boolean(accessToken) && isFavorite === null;

  return (
    <Button variant="secondary" size="sm" isLoading={isSubmitting || isCheckingStatus} onClick={toggle}>
      {isFavorite ? '★ В обраному' : '☆ В обране'}
    </Button>
  );
}
