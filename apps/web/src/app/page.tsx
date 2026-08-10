import Link from 'next/link';
import { getCategoryTree, search } from '@/lib/api';
import { ListingCard } from '@/components/listings/ListingCard';
import { EmptyState } from '@/components/ui';

export default async function HomePage() {
  const [categories, listings] = await Promise.all([
    getCategoryTree().catch(() => []),
    search({ sort: 'newest', limit: 12 }).catch(() => ({ items: [], nextCursor: null })),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section aria-labelledby="categories-heading" className="mb-10">
        <h2 id="categories-heading" className="mb-4 text-lg font-semibold text-gray-900">
          Категорії
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/search?category=${category.id}`}
              className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:border-brand-500 hover:text-brand-600 focus-visible:outline-none"
            >
              {category.nameUk}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="newest-heading">
        <h2 id="newest-heading" className="mb-4 text-lg font-semibold text-gray-900">
          Нові оголошення
        </h2>
        {listings.items.length === 0 ? (
          <EmptyState title="Поки немає оголошень" description="Скоро тут з'являться нові оголошення." />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {listings.items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
