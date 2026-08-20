import type { Metadata, Viewport } from 'next';
import { Rubik, Unbounded } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { LanguageProvider } from '@/lib/language-context';
import { Header } from '@/components/layout/Header';
import { SITE_URL } from '@/lib/site';

/**
 * Блокуючий inline-скрипт у <head> — виконується ДО першого paint, синхронно
 * ставить/знімає клас "dark" на <html>, інакше був би флеш світлої теми перед
 * тим, як React (ThemeProvider) встигне гідратуватись і прочитати localStorage.
 * Пріоритет: збережений вибір користувача → інакше system prefers-color-scheme.
 */
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('vzhyk.theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

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

// Без цього деякі Android-браузери (Samsung Internet "Затемнення сторінок", Chrome force-dark)
// самі вирішують, що сайт "не готовий" до теми пристрою, і накладають власну інверсію
// кольорів — саме так бренд-кольори (бірюза/жовтий) можуть виглядати "вигорілими". Тема тут
// уже керується вручну (клас "dark" + THEME_INIT_SCRIPT), тож явно кажемо браузеру не втручатись.
export const viewport: Viewport = {
  colorScheme: 'light dark',
};

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
  // suppressHydrationWarning — inline-скрипт нижче свідомо міняє className (клас "dark") ДО
  // гідратації; без цього пропа React сварився б на легітимну розбіжність server/client.
  return (
    <html lang="uk" className={`${rubik.variable} ${unbounded.variable}`} suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger -- статичний скрипт без user-controlled даних, потрібен до paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col bg-page font-sans text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        {/* Skip-link для keyboard/screen-reader навігації (базова accessibility, DEC-09) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
        >
          Перейти до основного контенту
        </a>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <Header />
              {/*
                flex-1 min-h-0 — реальна доступна висота під хедер, БЕЗ хардкоду його пікселів
                (був h-[calc(100vh-65px)] у chats/layout.tsx: ламався, коли хедер переносився на
                2 рядки через адмін-навігацію й ставав вищим за 65px — інпут чату виїжджав за
                межі екрана). min-h-0 обов'язковий — інакше flex-item не стискається нижче
                контенту (min-height:auto за замовчуванням) і сторінки типу /chats з overflow-y-auto
                всередині не отримують реальних меж для скролу.
              */}
              <main id="main-content" className="flex min-h-0 flex-1 flex-col">
                {children}
              </main>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
