import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ApiError,
  getCategoryAttributes,
  getCategoryTree,
  getCities,
  getListing,
  getListingMedia,
  search,
} from '@/lib/api';
import { Badge, Card } from '@/components/ui';
import { FavoriteButton } from '@/components/listings/FavoriteButton';
import { StartChatButton } from '@/components/listings/StartChatButton';
import { SellerPhoneButton } from '@/components/listings/SellerPhoneButton';
import { PriceOfferButton } from '@/components/listings/PriceOfferButton';
import { OwnerEditLink } from '@/components/listings/OwnerEditLink';
import { SellerCard } from '@/components/listings/SellerCard';
import { ListingGallery } from '@/components/listings/ListingGallery';
import { ListingCarousel } from '@/components/listings/ListingCarousel';
import { ReportButton } from '@/components/shared/ReportButton';
import { buildListingHref, parseListingIdParam } from '@/lib/slugify';
import { SITE_URL } from '@/lib/site';
import { formatPrice } from '@/lib/format';

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

  const [media, categoryAttributes, sellerListings, otherListings, cities, categoryTree] = await Promise.all([
    getListingMedia(id).catch(() => []),
    getCategoryAttributes(listing.categoryId).catch(() => []),
    search({ seller: listing.userId, sort: 'newest', limit: 9 }, 60)
      .then((r) => r.items.filter((item) => item.id !== id).slice(0, 8))
      .catch(() => []),
    // Свідомо не фільтруємо за тією самою категорією — ширший показ "інших оголошень"
    // по всьому маркетплейсу, не лише в межах поточної категорії.
    search({ sort: 'newest', limit: 9 }, 60)
      .then((r) => r.items.filter((item) => item.id !== id).slice(0, 8))
      .catch(() => []),
    getCities(3600).catch(() => []),
    getCategoryTree(3600).catch(() => []),
  ]);
  const cityName = listing.locationId ? cities.find((c) => c.id === listing.locationId)?.nameUk ?? null : null;
  // Топ-категорія оголошення (навіть якщо categoryId — підкатегорія) — потрібна лише для
  // звуження діапазону слайдера "Хочу дешевше" на авто/нерухомості (PriceOfferButton).
  const topCategoryName =
    categoryTree.find((c) => c.id === listing.categoryId)?.nameUk ??
    categoryTree.find((c) => c.children.some((child) => child.id === listing.categoryId))?.nameUk ??
    null;

  const attributeLabelById = new Map(
    categoryAttributes.map((attr) => [attr.id, attr.labelUk]),
  );
  const mainMedia = media.find((m) => m.isMain) ?? media[0];
  const sortedMedia = mainMedia
    ? [mainMedia, ...media.filter((m) => m.id !== mainMedia.id)]
    : media;

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
            <ListingGallery media={sortedMedia} title={listing.title} />
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
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {listing.viewsCount} переглядів
                </span>
              </div>
              <FavoriteButton listingId={listing.id} />
            </div>

            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {listing.title}
            </h1>
            <p className="mt-2 text-3xl font-extrabold text-brand-700 dark:text-brand-400">
              {formatPrice(listing.price, listing.currency)}
            </p>
            {listing.isNegotiable && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Торг можливий</p>
            )}
            {cityName && (
              <p className="mt-1 flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300">{cityName}</p>
            )}

            <div className="mt-4 flex flex-wrap items-start gap-2">
              <StartChatButton
                listingId={listing.id}
                ownerId={listing.userId}
              />
              <SellerPhoneButton sellerId={listing.userId} />
              {listing.price !== null && (
                <PriceOfferButton
                  listingId={listing.id}
                  ownerId={listing.userId}
                  price={listing.price}
                  currency={listing.currency}
                  topCategoryName={topCategoryName}
                />
              )}
              <OwnerEditLink listingId={listing.id} ownerId={listing.userId} />
              <ReportButton targetType="LISTING" targetId={listing.id} />
            </div>

            <SellerCard sellerId={listing.userId} />

            {listing.attributes.length > 0 && (
              <Card className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Характеристики
                </h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {listing.attributes.map((attr) => (
                    <div key={attr.id} className="contents">
                      <dt className="text-gray-500 dark:text-gray-400">
                        {attributeLabelById.get(attr.categoryAttributeId) ??
                          '—'}
                      </dt>
                      <dd className="text-gray-900 dark:text-gray-100">
                        {formatAttributeValue(attr.value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            {listing.description && (
              <Card className="mt-6">
                <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Опис
                </h2>
                <p className="whitespace-pre-wrap leading-relaxed text-gray-700 dark:text-gray-300">
                  {listing.description}
                </p>
              </Card>
            )}
          </div>
        </div>

        {sellerListings.length > 0 && (
          <section aria-labelledby="seller-listings-heading" className="mt-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 id="seller-listings-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Усі оголошення автора
              </h2>
              <Link href={`/search?seller=${listing.userId}`} className="text-sm text-brand-600 hover:underline dark:text-brand-400">
                Дивитися всі →
              </Link>
            </div>
            <ListingCarousel items={sellerListings} />
          </section>
        )}

        {otherListings.length > 0 && (
          <section aria-labelledby="other-listings-heading" className="mt-10">
            <h2 id="other-listings-heading" className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Інші оголошення
            </h2>
            <ListingCarousel items={otherListings} />
          </section>
        )}
      </div>
    </>
  );
}
