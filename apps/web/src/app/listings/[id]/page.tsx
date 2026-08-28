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
import { ShareButton } from '@/components/listings/ShareButton';
import { buildListingHref, parseListingIdParam } from '@/lib/slugify';
import { SITE_URL } from '@/lib/site';
import { formatPrice, parseDescription } from '@/lib/format';

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

  const [media, categoryAttributes, sellerListings, otherListingsRaw, cities, categoryTree] = await Promise.all([
    getListingMedia(id).catch(() => []),
    getCategoryAttributes(listing.categoryId).catch(() => []),
    search({ seller: listing.userId, sort: 'newest', limit: 9 }, 60)
      .then((r) => r.items.filter((item) => item.id !== id).slice(0, 8))
      .catch(() => []),
    // Свідомо не фільтруємо за тією самою категорією — ширший показ "інших оголошень"
    // по всьому маркетплейсу, не лише в межах поточної категорії.
    search({ sort: 'newest', limit: 17 }, 60)
      .then((r) => r.items.filter((item) => item.id !== id))
      .catch(() => []),
    getCities(3600).catch(() => []),
    getCategoryTree(3600).catch(() => []),
  ]);
  // "Інші оголошення" не мають дублювати "Усі оголошення автора" — з малою кількістю
  // реальних продавців на платформі обидва блоки тягнули майже той самий набір карток
  // (аудит 27.08: "показують однаковий набір карток").
  const sellerListingIds = new Set(sellerListings.map((item) => item.id));
  const otherListings = otherListingsRaw.filter((item) => !sellerListingIds.has(item.id)).slice(0, 8);

  const cityName = listing.locationId ? cities.find((c) => c.id === listing.locationId)?.nameUk ?? null : null;
  // Топ-категорія оголошення (навіть якщо categoryId — підкатегорія) — потрібна і для
  // звуження діапазону слайдера "Хочу дешевше" (PriceOfferButton), і для хлібних крихт.
  const matchedTop = categoryTree.find((c) => c.id === listing.categoryId);
  const matchedParent = categoryTree.find((c) => c.children.some((child) => child.id === listing.categoryId));
  const topCategoryName = matchedTop?.nameUk ?? matchedParent?.nameUk ?? null;
  const topCategoryId = matchedTop?.id ?? matchedParent?.id ?? null;
  const topCategorySlug = matchedTop?.slug ?? matchedParent?.slug ?? null;
  // Хлібні крихти показують підкатегорію лише коли categoryId сам є підкатегорією
  // (matchedTop===undefined означає, що знайдений збіг — саме дитина, не сам верхній рівень).
  const subCategory = !matchedTop ? matchedParent?.children.find((child) => child.id === listing.categoryId) : null;

  const publishedDate = listing.publishedAt
    ? new Intl.DateTimeFormat('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(listing.publishedAt))
    : null;
  const listingRef = listing.id.slice(0, 8).toUpperCase();
  const canonicalUrl = `${SITE_URL}${buildListingHref(listing.id, listing.title)}`;

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

  const breadcrumbItems = [
    { name: 'Головна', path: '/' },
    // Чисті URL (аудит 27.08) є лише для кореневих категорій — підкатегорія власного
    // ЧПУ-маршруту не має, лишається на /search?category=uuid.
    ...(topCategoryName && topCategorySlug
      ? [{ name: topCategoryName, path: `/${topCategorySlug}` }]
      : []),
    ...(subCategory ? [{ name: subCategory.nameUk, path: `/search?category=${subCategory.id}` }] : []),
    { name: listing.title, path: buildListingHref(listing.id, listing.title) },
  ].map((item) => ({ ...item, url: `${SITE_URL}${item.path}` }));
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      {/* eslint-disable-next-line react/no-danger -- статичний JSON-LD, без user-controlled HTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* eslint-disable-next-line react/no-danger -- статичний JSON-LD, без user-controlled HTML */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="mx-auto max-w-4xl px-4 py-8">
        <nav aria-label="Хлібні крихти" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
          {breadcrumbItems.map((item, index) => (
            <span key={item.url} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden="true">/</span>}
              {index === breadcrumbItems.length - 1 ? (
                <span className="max-w-[16rem] truncate text-gray-700 dark:text-gray-300">{item.name}</span>
              ) : (
                <Link href={item.path} className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
                  {item.name}
                </Link>
              )}
            </span>
          ))}
        </nav>
        <div className="grid gap-8 md:grid-cols-2 md:items-start">
          {/* sticky — права колонка (характеристики + опис) зазвичай значно довша за галерею,
              інакше під фото лишається порожній простір на всю різницю висот при скролі. */}
          <div className="md:sticky md:top-4">
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
            {/* Аудит 27.08: "немає дати публікації — базовий сигнал актуальності" і "немає
                номера оголошення (на нього посилаються в переписці)". */}
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {publishedDate && <>Опубліковано {publishedDate} · </>}№ {listingRef}
            </p>

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
              <ShareButton url={canonicalUrl} title={listing.title} />
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
                <div className="leading-relaxed text-gray-700 dark:text-gray-300">
                  {parseDescription(listing.description).map((block, index) =>
                    block.type === 'list' ? (
                      <ul key={index} className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0">
                        {block.lines.map((line, lineIndex) => (
                          <li key={lineIndex}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      <p key={index} className="mb-2 whitespace-pre-wrap last:mb-0">
                        {block.lines[0]}
                      </p>
                    ),
                  )}
                </div>
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
