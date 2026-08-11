'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui';

export function OwnerEditLink({ listingId, ownerId }: { listingId: string; ownerId: string }) {
  const { user } = useAuth();

  if (!user || user.id !== ownerId) {
    return null;
  }

  return (
    <Link href={`/listings/${listingId}/edit`}>
      <Button size="sm" variant="secondary">
        Редагувати оголошення
      </Button>
    </Link>
  );
}
