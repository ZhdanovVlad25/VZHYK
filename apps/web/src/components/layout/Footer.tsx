import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 py-6 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 text-center">
        <span>© {new Date().getFullYear()} Вжик</span>
        <Link href="/rules" className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
          Правила користування
        </Link>
        <Link href="/oferta" className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
          Публічна оферта
        </Link>
        <Link href="/privacy" className="hover:text-brand-600 hover:underline dark:hover:text-brand-400">
          Політика конфіденційності
        </Link>
      </div>
    </footer>
  );
}
