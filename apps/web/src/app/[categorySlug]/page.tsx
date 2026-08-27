import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryTree, search, type Category } from '@/lib/api';
import { pluralizeListings } from '@/lib/format';
import { ListingCard } from '@/components/listings/ListingCard';
import { EmptyState } from '@/components/ui';
import { SITE_URL } from '@/lib/site';

// Категорії не персоналізовані й без побічних ефектів на GET — безпечно кешувати (ISR),
// той самий revalidate, що й головна сторінка.
export const revalidate = 60;

/**
 * Аудит 27.08 "чисті URL категорій" — лендинг категорії на /{slug} замість /search?category=uuid.
 * Резолвимо лише кореневі (level 0) категорії: підкатегорії наразі власного ЧПУ-маршруту
 * не мають (slug унікальний лише в межах parentId, не глобально) — детальніший фільтр
 * лишається на /search?category=uuid.
 */
async function resolveCategory(slug: string): Promise<Category | null> {
  const tree = await getCategoryTree(300).catch(() => []);
  return tree.find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: { categorySlug: string };
}): Promise<Metadata> {
  const category = await resolveCategory(params.categorySlug);
  if (!category) return { title: 'Категорія' };

  const title = `${category.nameUk} — оголошення на Вжику`;
  const description = `Оголошення в категорії «${category.nameUk}» по всій Україні. Купуйте і продавайте на Вжику.`;
  return {
    title,
    description,
    alternates: { canonical: `/${category.slug}` },
    openGraph: { title, description, url: `${SITE_URL}/${category.slug}`, type: 'website' },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: { categorySlug: string };
}) {
  const category = await resolveCategory(params.categorySlug);
  if (!category) notFound();

  const result = await search({ category: category.id, sort: 'newest', limit: 24 }, 60).catch(() => ({
    items: [],
    nextCursor: null,
    total: 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{category.nameUk}</h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Знайдено {result.total} {pluralizeListings(result.total)}
          </p>
        </div>
        <Link
          href={`/search?category=${category.id}`}
          className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          Фільтри та сортування →
        </Link>
      </div>

      {category.children.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.id}
              href={`/search?category=${child.id}`}
              className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-opacity hover:opacity-80 dark:bg-gray-800 dark:text-brand-400"
            >
              {child.nameUk}
            </Link>
          ))}
        </div>
      )}

      {result.items.length === 0 ? (
        <EmptyState title="Поки немає оголошень" description="У цій категорії ще немає активних оголошень." />
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {result.items.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
