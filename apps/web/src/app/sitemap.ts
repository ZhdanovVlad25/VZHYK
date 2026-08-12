import type { MetadataRoute } from 'next';
import { search } from '@/lib/api';
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

  const listings = await listingEntries();

  return [...staticEntries, ...listings];
}
