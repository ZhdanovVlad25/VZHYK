/** Публічна базова URL сайту — потрібна для абсолютних посилань у sitemap.xml/robots.txt/OG-тегах/canonical. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');
