import Link from 'next/link';
import type { SearchResultItem } from '@/lib/api';

function formatPrice(price: number | null, currency: string): string {
  if (price === null) {
    return 'Ціна не вказана';
  }
  return new Intl.NumberFormat('uk-UA', { style: 'currency', currency, maximumFractionDigits: 0 }).format(price);
}

/**
 * Не використовує спільний Card — у Card фіксований p-4 без варіанту "без відступів",
 * а тут потрібне фото на всю ширину картки без рамки навколо нього.
 */
export function ListingCard({ item }: { item: SearchResultItem }) {
  return (
    <Link href={`/listings/${item.id}`} className="block focus-visible:outline-none">
      <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
        <div className="aspect-square w-full bg-gray-100">
          {item.mainMediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- зображення з presigned S3/MinIO URL, next/image domain-конфіг поза цим зрізом
            <img src={item.mainMediaUrl} alt={item.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">Без фото</div>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 p-3">
          <p className="line-clamp-2 text-sm font-medium text-gray-900">{item.title}</p>
          <p className="mt-auto font-semibold text-gray-900">{formatPrice(item.price, item.currency)}</p>
        </div>
      </div>
    </Link>
  );
}
