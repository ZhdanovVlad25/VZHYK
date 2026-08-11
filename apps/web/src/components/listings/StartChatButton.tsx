'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, createChat } from '@/lib/api';
import { Button } from '@/components/ui';

export function StartChatButton({ listingId, ownerId }: { listingId: string; ownerId: string }) {
  const router = useRouter();
  const { user, accessToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user && user.id === ownerId) {
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
      const chat = await createChat(ownerId, listingId, accessToken);
      router.push(`/chats/${chat.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося почати чат.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div>
      <Button size="sm" isLoading={isLoading} onClick={handleClick}>
        Написати продавцю
      </Button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
