'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ApiError, getListing, getListingMedia, publishListing, uploadListingMedia, type Listing, type Media } from '@/lib/api';
import { Alert, Badge, Button, Card, ErrorState, LoadingState } from '@/components/ui';

function formatPrice(price: number | null, currency: string): string {
  if (price === null) return 'Ціна не вказана';
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listing, setListing] = useState<Listing | null>(null);
  const [media, setMedia] = useState<Media[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [listingResult, mediaResult] = await Promise.all([
        getListing(params.id, accessToken),
        getListingMedia(params.id),
      ]);
      setListing(listingResult);
      setMedia(mediaResult);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Не вдалося завантажити оголошення.');
    } finally {
      setIsLoading(false);
    }
  }, [params.id, accessToken]);

  useEffect(() => {
    if (accessToken) {
      load();
    }
  }, [accessToken, load]);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;
    setActionError(null);
    setIsUploading(true);
    try {
      await uploadListingMedia(params.id, file, accessToken);
      const fresh = await getListingMedia(params.id);
      setMedia(fresh);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося завантажити фото.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handlePublish() {
    if (!accessToken) return;
    setActionError(null);
    setIsPublishing(true);
    try {
      await publishListing(params.id, accessToken);
      router.push(`/listings/${params.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Не вдалося опублікувати оголошення.');
    } finally {
      setIsPublishing(false);
    }
  }

  if (!authLoading && !user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center text-gray-700">
        Щоб редагувати оголошення, потрібно увійти.
      </div>
    );
  }

  if (authLoading || isLoading) {
    return <LoadingState label="Завантаження оголошення…" />;
  }

  if (loadError || !listing) {
    return <ErrorState description={loadError ?? 'Оголошення не знайдено'} onRetry={load} />;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone={listing.status === 'DRAFT' ? 'neutral' : 'success'}>{listing.status}</Badge>
        <h1 className="text-2xl font-semibold text-gray-900">{listing.title}</h1>
      </div>
      <p className="mb-6 text-xl font-semibold text-brand-600">{formatPrice(listing.price, listing.currency)}</p>

      {actionError && (
        <Alert tone="danger" title="Помилка" className="mb-4">
          {actionError}
        </Alert>
      )}

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Фото</h2>
        <div className="mb-3 grid grid-cols-4 gap-2">
          {media.map((m) => (
            // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
            <img
              key={m.id}
              src={m.url}
              alt=""
              className="aspect-square w-full rounded-md border border-gray-200 object-cover"
            />
          ))}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelected}
          disabled={isUploading}
          className="text-sm"
        />
        {isUploading && <p className="mt-1 text-sm text-gray-500">Завантаження…</p>}
      </Card>

      {listing.status === 'DRAFT' || listing.status === 'REJECTED' ? (
        <Button isLoading={isPublishing} onClick={handlePublish}>
          Опублікувати
        </Button>
      ) : (
        <p className="text-sm text-gray-500">Оголошення вже опубліковано.</p>
      )}
    </div>
  );
}
