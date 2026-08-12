import type { Metadata } from 'next';
import { Rubik, Unbounded } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/layout/Header';
import { SITE_URL } from '@/lib/site';

// Cyrillic-підмножина обов'язкова — увесь контент українською.
// Rubik — основний UI/body-текст (заокруглені літери, але читається дрібним кеглем).
const rubik = Rubik({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-rubik',
  display: 'swap',
});

// Unbounded — display-шрифт лише для заголовків/лого (h1-h3, wordmark у Header).
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '800'],
  variable: '--font-unbounded',
  display: 'swap',
});

const DESCRIPTION =
  'Україномовна платформа оголошень: продаж, купівля, обмін, робота, житло.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Вжик — оголошення', template: '%s — Вжик' },
  description: DESCRIPTION,
  openGraph: {
    siteName: 'Вжик',
    type: 'website',
    locale: 'uk_UA',
    title: 'Вжик — оголошення',
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk" className={`${rubik.variable} ${unbounded.variable}`}>
      <body className="min-h-screen bg-page font-sans text-gray-900 antialiased">
        {/* Skip-link для keyboard/screen-reader навігації (базова accessibility, DEC-09) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Перейти до основного контенту
        </a>
        <AuthProvider>
          <Header />
          <main id="main-content">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
