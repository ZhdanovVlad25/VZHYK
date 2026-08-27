import type { MetadataRoute } from 'next';
import { getCategoryTree, search } from '@/lib/api';
import { buildListingHref } from '@/lib/slugify';
import { SITE_URL } from '@/lib/site';

const MAX_PAGES = 10; // 10 × 50 = до 500 найновіших активних оголошень — достатньо для MVP без окремого sitemap-index

async function listingEntries(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await search({ sort: 'newest', limit: 50, cursor }).catch(
      () => ({ items: [], nextCursor: null }),
    );
    for (const item of result.items) {
      entries.push({
        url: `${SITE_URL}${buildListingHref(item.id, item.title)}`,
        lastModified: item.publishedAt ?? undefined,
        changeFrequency: 'daily',
        priority: 0.7,
      });
    }
    if (!result.nextCursor) break;
    cursor = result.nextCursor;
  }

  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'hourly', priority: 1 },
    { url: `${SITE_URL}/search`, changeFrequency: 'hourly', priority: 0.8 },
  ];

  // Чисті URL категорій (аудит 27.08) — лише кореневий рівень, без комбінацій з містом
  // (15 категорій × 49 міст дали б >700 переважно порожніх сторінок для 3 реальних оголошень).
  const categories = await getCategoryTree(300).catch(() => []);
  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${SITE_URL}/${category.slug}`,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const listings = await listingEntries();

  return [...staticEntries, ...categoryEntries, ...listings];
}
