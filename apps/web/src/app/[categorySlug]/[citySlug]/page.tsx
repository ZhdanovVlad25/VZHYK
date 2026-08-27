import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCategoryTree, getCities, search, type Category, type City } from '@/lib/api';
import { pluralizeListings } from '@/lib/format';
import { ListingCard } from '@/components/listings/ListingCard';
import { EmptyState } from '@/components/ui';
import { SITE_URL } from '@/lib/site';

export const revalidate = 60;

async function resolveCategoryAndCity(
  categorySlug: string,
  citySlug: string,
): Promise<{ category: Category; city: City } | null> {
  const [tree, cities] = await Promise.all([
    getCategoryTree(300).catch(() => []),
    getCities(3600).catch(() => []),
  ]);
  const category = tree.find((c) => c.slug === categorySlug);
  const city = cities.find((c) => c.slug === citySlug);
  if (!category || !city) return null;
  return { category, city };
}

export async function generateMetadata({
  params,
}: {
  params: { categorySlug: string; citySlug: string };
}): Promise<Metadata> {
  const resolved = await resolveCategoryAndCity(params.categorySlug, params.citySlug);
  if (!resolved) return { title: 'Категорія' };

  const { category, city } = resolved;
  const title = `${category.nameUk} у місті ${city.nameUk} — Вжик`;
  const description = `Оголошення в категорії «${category.nameUk}» у місті ${city.nameUk}. Купуйте і продавайте на Вжику.`;
  const canonicalPath = `/${category.slug}/${city.slug}`;
  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: `${SITE_URL}${canonicalPath}`, type: 'website' },
  };
}

export default async function CategoryCityPage({
  params,
}: {
  params: { categorySlug: string; citySlug: string };
}) {
  const resolved = await resolveCategoryAndCity(params.categorySlug, params.citySlug);
  if (!resolved) notFound();
  const { category, city } = resolved;

  const result = await search({ category: category.id, location: city.id, sort: 'newest', limit: 24 }, 60).catch(
    () => ({ items: [], nextCursor: null, total: 0 }),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {category.nameUk} — {city.nameUk}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Знайдено {result.total} {pluralizeListings(result.total)}
          </p>
        </div>
        <Link
          href={`/search?category=${category.id}&location=${city.id}`}
          className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          Фільтри та сортування →
        </Link>
      </div>

      {result.items.length === 0 ? (
        <EmptyState
          title="Поки немає оголошень"
          description={`У категорії «${category.nameUk}» в місті ${city.nameUk} ще немає активних оголошень.`}
        />
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
