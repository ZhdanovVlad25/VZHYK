import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Автентифіковані/приватні маршрути — індексувати нема сенсу, і краулер там однаково впреться в /login.
      disallow: [
        '/admin',
        '/login',
        '/auth',
        '/my-listings',
        '/favorites',
        '/saved-searches',
        '/chats',
        '/listings/new',
        '/listings/*/edit',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
