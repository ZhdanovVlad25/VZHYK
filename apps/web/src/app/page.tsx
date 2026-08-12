import Link from 'next/link';
import { getCategoryTree, search } from '@/lib/api';
import { ListingCard } from '@/components/listings/ListingCard';
import { EmptyState } from '@/components/ui';

// Ротація світлих tint-фонів з палітри маскота (docs/design.md) — без цього
// категорії губилися на білому тлі суцільною сірою рамкою.
const CATEGORY_TINTS = [
  'bg-brand-100 text-brand-700',
  'bg-accent-100 text-accent-700',
  'bg-highlight-100 text-highlight-900',
];

// Категорії/новинки не персоналізовані й без побічних ефектів на GET — безпечно кешувати (ISR).
export const revalidate = 60;

export default async function HomePage() {
  const [categories, listings] = await Promise.all([
    getCategoryTree(300).catch(() => []),
    search({ sort: 'newest', limit: 12 }, 60).catch(() => ({
      items: [],
      nextCursor: null,
    })),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section aria-labelledby="categories-heading" className="mb-10">
        <h2
          id="categories-heading"
          className="mb-4 text-lg font-semibold text-gray-900"
        >
          Категорії
        </h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((category, index) => (
            <Link
              key={category.id}
              href={`/search?category=${category.id}`}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80 focus-visible:outline-none ${CATEGORY_TINTS[index % CATEGORY_TINTS.length]}`}
            >
              {category.nameUk}
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="newest-heading">
        <h2
          id="newest-heading"
          className="mb-4 text-lg font-semibold text-gray-900"
        >
          Нові оголошення
        </h2>
        {listings.items.length === 0 ? (
          <EmptyState
            title="Поки немає оголошень"
            description="Скоро тут з'являться нові оголошення."
          />
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
