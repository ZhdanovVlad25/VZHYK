import Link from 'next/link';
import { getCategoryTree, search } from '@/lib/api';
import { ListingCard } from '@/components/listings/ListingCard';
import { EmptyState } from '@/components/ui';

// Ротація світлих tint-фонів з палітри маскота (docs/design.md) — без цього
// категорії губилися на білому тлі суцільною сірою рамкою.
// dark: тільки реально наявні стопи (accent/highlight не мають повного 50-900 ряду, tailwind.config.js).
const CATEGORY_TINTS = [
  'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200',
  'bg-accent-100 text-accent-700 dark:bg-accent-700/30 dark:text-accent-100',
  'bg-highlight-100 text-highlight-900 dark:bg-highlight-500/20 dark:text-highlight-400',
];

// Категорії/новинки не персоналізовані й без побічних ефектів на GET — безпечно кешувати (ISR).
export const revalidate = 60;

export default async function HomePage() {
  const [categories, listings] = await Promise.all([
    getCategoryTree(300).catch(() => []),
    search({ sort: 'newest', limit: 15 }, 60).catch(() => ({
      items: [],
      nextCursor: null,
    })),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Аудит 27.08: "Головна без H1" — сторінка мала лише два h2, жодного h1 у DOM. */}
      <h1 className="mb-8 text-2xl font-semibold text-gray-900 dark:text-gray-100 sm:text-3xl">
        Купуйте й продавайте на Вжику — оголошення по всій Україні
      </h1>

      <section aria-labelledby="categories-heading" className="mb-10">
        <h2
          id="categories-heading"
          className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100"
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
        <div className="mb-4 flex items-center gap-3">
          <h2 id="newest-heading" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Нові оголошення
          </h2>
          <Link href="/search?sort=newest" className="text-sm text-brand-600 hover:underline dark:text-brand-400">
            Переглянути всі →
          </Link>
        </div>
        {listings.items.length === 0 ? (
          <EmptyState
            title="Поки немає оголошень"
            description="Скоро тут з'являться нові оголошення."
          />
        ) : (
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {listings.items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
