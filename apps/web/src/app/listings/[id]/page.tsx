import { notFound } from 'next/navigation';
import { ApiError, getCategoryAttributes, getListing, getListingMedia } from '@/lib/api';
import { Badge, Card } from '@/components/ui';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { StartChatButton } from '@/components/listings/StartChatButton';
import { OwnerEditLink } from '@/components/listings/OwnerEditLink';
import { ReportButton } from '@/components/shared/ReportButton';

function formatPrice(price: number | null, currency: string): string {
  if (price === null) {
    return 'Ціна не вказана';
  }
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

function formatAttributeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні';
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    const range = value as { min?: unknown; max?: unknown };
    if ('min' in range || 'max' in range) return `${range.min ?? '?'} – ${range.max ?? '?'}`;
  }
  return String(value);
}

export default async function ListingDetailPage({ params }: { params: { id: string } }) {
  let listing;
  try {
    listing = await getListing(params.id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [media, categoryAttributes] = await Promise.all([
    getListingMedia(params.id).catch(() => []),
    getCategoryAttributes(listing.categoryId).catch(() => []),
  ]);

  const attributeLabelById = new Map(categoryAttributes.map((attr) => [attr.id, attr.labelUk]));
  const mainMedia = media.find((m) => m.isMain) ?? media[0];
  const otherMedia = media.filter((m) => m.id !== mainMedia?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div>
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
            {mainMedia ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
              <img src={mainMedia.url} alt={listing.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Без фото</div>
            )}
          </div>
          {otherMedia.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {otherMedia.map((m) => (
                // eslint-disable-next-line @next/next/no-img-element -- presigned S3/MinIO URL
                <img
                  key={m.id}
                  src={m.url}
                  alt=""
                  className="aspect-square w-full rounded-md border border-gray-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge tone={listing.status === 'ACTIVE' ? 'success' : listing.status === 'SOLD' ? 'neutral' : 'warning'}>
                {listing.status}
              </Badge>
              <span className="text-sm text-gray-500">{listing.viewsCount} переглядів</span>
            </div>
            <FavoriteButton listingId={listing.id} />
          </div>

          <h1 className="text-2xl font-semibold text-gray-900">{listing.title}</h1>
          <p className="mt-2 text-3xl font-bold text-brand-600">{formatPrice(listing.price, listing.currency)}</p>
          {listing.isNegotiable && <p className="mt-1 text-sm text-gray-500">Торг можливий</p>}

          <div className="mt-4 flex flex-wrap items-start gap-2">
            <StartChatButton listingId={listing.id} ownerId={listing.userId} />
            <OwnerEditLink listingId={listing.id} ownerId={listing.userId} />
            <ReportButton targetType="LISTING" targetId={listing.id} />
          </div>

          {listing.description && (
            <p className="mt-6 whitespace-pre-wrap text-gray-700">{listing.description}</p>
          )}

          {listing.attributes.length > 0 && (
            <Card className="mt-6">
              <h2 className="mb-3 text-sm font-semibold text-gray-900">Характеристики</h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {listing.attributes.map((attr) => (
                  <div key={attr.id} className="contents">
                    <dt className="text-gray-500">{attributeLabelById.get(attr.categoryAttributeId) ?? '—'}</dt>
                    <dd className="text-gray-900">{formatAttributeValue(attr.value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
