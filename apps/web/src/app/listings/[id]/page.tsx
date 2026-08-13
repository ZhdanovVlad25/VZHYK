import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  ApiError,
  getCategoryAttributes,
  getListing,
  getListingMedia,
} from '@/lib/api';
import { Badge, Card } from '@/components/ui';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { StartChatButton } from '@/components/listings/StartChatButton';
import { OwnerEditLink } from '@/components/listings/OwnerEditLink';
import { ReportButton } from '@/components/shared/ReportButton';
import { buildListingHref, parseListingIdParam } from '@/lib/slugify';
import { SITE_URL } from '@/lib/site';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Чернетка',
  PENDING_MODERATION: 'На модерації',
  ACTIVE: 'Активне',
  REJECTED: 'Відхилено',
  RESERVED: 'Зарезервовано',
  SOLD: 'Продано',
  EXPIRED: 'Термін минув',
  ARCHIVED: 'В архіві',
  BLOCKED: 'Заблоковано',
};

function formatPrice(price: number | null, currency: string): string {
  if (price === null) {
    return 'Ціна не вказана';
  }
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatAttributeValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Так' : 'Ні';
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') {
    const range = value as { min?: unknown; max?: unknown };
    if ('min' in range || 'max' in range)
      return `${range.min ?? '?'} – ${range.max ?? '?'}`;
  }
  return String(value);
}

/**
 * getListing() інкрементує viewsCount на бекенді (listings.service.ts findVisible()) для
 * не-власників — свідомо НЕ кешуємо цей fetch (revalidate), інакше лічильник переглядів
 * заморозиться на вікно кешу. generateMetadata викликає той самий getListing() вдруге
 * (Next дедуплікує однакові fetch у межах одного рендеру запиту, тож подвійного
 * інкременту не буде — дедуплікація працює за URL+опціями, обидва виклики ідентичні).
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const id = parseListingIdParam(params.id);
  try {
    const listing = await getListing(id);
    const canonicalPath = buildListingHref(listing.id, listing.title);
    const description = listing.description
      ? listing.description.slice(0, 160)
      : `${listing.title} — оголошення на Вжик`;
    const media = await getListingMedia(id).catch(() => []);
    const mainMediaUrl = (media.find((m) => m.isMain) ?? media[0])?.url;

    return {
      title: listing.title,
      description,
      alternates: { canonical: canonicalPath },
      openGraph: {
        title: listing.title,
        description,
        url: `${SITE_URL}${canonicalPath}`,
        type: 'website',
        images: mainMediaUrl ? [{ url: mainMediaUrl }] : undefined,
      },
    };
  } catch {
    return { title: 'Оголошення' };
  }
}

export default async function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = parseListingIdParam(params.id);
  let listing;
  try {
    listing = await getListing(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const [media, categoryAttributes] = await Promise.all([
    getListingMedia(id).catch(() => []),
    getCategoryAttributes(listing.categoryId).catch(() => []),
  ]);

  const attributeLabelById = new Map(
    categoryAttributes.map((attr) => [attr.id, attr.labelUk]),
  );
  const mainMedia = media.find((m) => m.isMain) ?? media[0];
  const otherMedia = media.filter((m) => m.id !== mainMedia?.id);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description ?? undefined,
    image: mainMedia ? [mainMedia.url] : undefined,
    offers: {
      '@type': 'Offer',
      price: listing.price ?? undefined,
      priceCurrency: listing.currency,
      availability:
        listing.status === 'ACTIVE'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}${buildListingHref(listing.id, listing.title)}`,
    },
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- статичний JSON-LD, без user-controlled HTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
              {mainMedia ? (
                <Image
                  src={mainMedia.url}
                  alt={listing.title}
                  fill
                  priority
                  sizes="(min-width: 768px) 50vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                  Без фото
                </div>
              )}
            </div>
            {otherMedia.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-2">
                {otherMedia.map((m) => (
                  <div
                    key={m.id}
                    className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200"
                  >
                    <Image
                      src={m.url}
                      alt=""
                      fill
                      sizes="25vw"
                      className="object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  tone={
                    listing.status === 'ACTIVE'
                      ? 'success'
                      : listing.status === 'SOLD'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {STATUS_LABELS[listing.status] ?? listing.status}
                </Badge>
                <span className="text-sm text-gray-500">
                  {listing.viewsCount} переглядів
                </span>
              </div>
              <FavoriteButton listingId={listing.id} />
            </div>

            <h1 className="text-2xl font-semibold text-gray-900">
              {listing.title}
            </h1>
            <p className="mt-2 text-3xl font-extrabold text-accent-600">
              {formatPrice(listing.price, listing.currency)}
            </p>
            {listing.isNegotiable && (
              <p className="mt-1 text-sm text-gray-500">Торг можливий</p>
            )}

            <div className="mt-4 flex flex-wrap items-start gap-2">
              <StartChatButton
                listingId={listing.id}
                ownerId={listing.userId}
              />
              <OwnerEditLink listingId={listing.id} ownerId={listing.userId} />
              <ReportButton targetType="LISTING" targetId={listing.id} />
            </div>

            {listing.description && (
              <p className="mt-6 whitespace-pre-wrap text-gray-700">
                {listing.description}
              </p>
            )}

            {listing.attributes.length > 0 && (
              <Card className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">
                  Характеристики
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {listing.attributes.map((attr) => (
                    <div key={attr.id} className="contents">
                      <dt className="text-gray-500">
                        {attributeLabelById.get(attr.categoryAttributeId) ??
                          '—'}
                      </dt>
                      <dd className="text-gray-900">
                        {formatAttributeValue(attr.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
