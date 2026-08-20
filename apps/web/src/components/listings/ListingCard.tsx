import Link from 'next/link';
import Image from 'next/image';
import type { SearchResultItem } from '@/lib/api';
import { buildListingHref } from '@/lib/slugify';
import { formatPrice } from '@/lib/format';

const NEW_BADGE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Не використовує спільний Card — у Card фіксований p-4 без варіанту "без відступів",
 * а тут потрібне фото на всю ширину картки без рамки навколо нього.
 */
export function ListingCard({ item }: { item: SearchResultItem }) {
  const isNew =
    !!item.publishedAt && Date.now() - new Date(item.publishedAt).getTime() < NEW_BADGE_THRESHOLD_MS;

  return (
    <Link
      href={buildListingHref(item.id, item.title)}
      className="block focus-visible:outline-none"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 shadow-sm transition-shadow hover:border-highlight-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-highlight-500">
        <div className="relative aspect-square w-full bg-brand-100 dark:bg-gray-700">
          {isNew && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-highlight-400 px-2 py-0.5 text-xs font-bold text-highlight-900 shadow-sm">
              Нове
            </span>
          )}
          {item.mainMediaUrl ? (
            <Image
              src={item.mainMediaUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-brand-500 dark:text-gray-400">
              Без фото
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-gray-900 dark:text-gray-100">
            {item.title}
          </p>
          <p className="font-extrabold text-brand-700 dark:text-brand-400">
            {formatPrice(item.price, item.currency)}
          </p>
          {item.locationName && (
            <p className="mt-auto text-xs text-gray-500 dark:text-gray-400">{item.locationName}</p>
          )}
        </div>
      </div>
    </Link>
  );
}
