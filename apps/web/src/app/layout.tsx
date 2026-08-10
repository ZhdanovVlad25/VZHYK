import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/layout/Header';

export const metadata: Metadata = {
  title: 'Вжик — оголошення',
  description: 'Україномовна платформа оголошень: продаж, купівля, обмін, робота, житло.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
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
