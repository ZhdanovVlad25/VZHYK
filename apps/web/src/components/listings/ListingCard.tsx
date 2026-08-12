import Link from 'next/link';
import Image from 'next/image';
import type { SearchResultItem } from '@/lib/api';
import { buildListingHref } from '@/lib/slugify';

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

/**
 * Не використовує спільний Card — у Card фіксований p-4 без варіанту "без відступів",
 * а тут потрібне фото на всю ширину картки без рамки навколо нього.
 */
export function ListingCard({ item }: { item: SearchResultItem }) {
  return (
    <Link
      href={buildListingHref(item.id, item.title)}
      className="block focus-visible:outline-none"
    >
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-brand-100 bg-brand-50 shadow-sm transition-shadow hover:shadow-md">
        <div className="relative aspect-square w-full bg-brand-100">
          {item.mainMediaUrl ? (
            <Image
              src={item.mainMediaUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1024px) 16vw, (min-width: 640px) 33vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-brand-500">
              Без фото
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium text-gray-900">
            {item.title}
          </p>
          <p className="mt-auto font-extrabold text-accent-600">
            {formatPrice(item.price, item.currency)}
          </p>
        </div>
      </div>
    </Link>
  );
}
