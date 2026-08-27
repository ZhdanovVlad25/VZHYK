import type { MetadataRoute } from 'next';

/**
 * Спеціальний файл Next.js — авто-роут /manifest.webmanifest (аудит 27.08: цей шлях
 * повертав 404, тож "додати на головний екран" давало безіменну іконку).
 * icon-192/512.png згенеровані з тієї ж SVG-розмітки, що й Logo.tsx/icon.svg (favicon),
 * через sharp — public/, бо manifest посилається на них за прямим шляхом, не як на
 * спеціальний Next-файл.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Вжик — оголошення',
    short_name: 'Вжик',
    description: 'Україномовна платформа оголошень: продаж, купівля, обмін, робота, житло.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#238A80',
    lang: 'uk',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
