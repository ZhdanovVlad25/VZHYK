import Link from 'next/link';
import { getCategoryTree } from '@/lib/api';
import { Button } from '@/components/ui';

/**
 * Аудит 27.08: "404 — стандартна сторінка Next.js англійською... без брендингу, без
 * пошуку, без посилання на головну". Для маркетплейсу з оголошеннями, що з часом
 * архівуються/знімаються, це не рідкісна сторінка — власна 404 з живим пошуком і
 * категоріями дає шанс втримати відвідувача замість глухого кута.
 */
export default async function NotFound() {
  const categories = await getCategoryTree(300).catch(() => []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <p className="text-7xl font-extrabold text-brand-200 dark:text-brand-900">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-100">
        Сторінку не знайдено
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Можливо, оголошення вже продано чи знято з публікації, або посилання застаріло.
      </p>

      <form action="/search" className="mx-auto mt-6 flex max-w-md gap-2">
        <label htmlFor="not-found-search" className="sr-only">
          Пошук оголошень
        </label>
        <input
          id="not-found-search"
          name="q"
          type="search"
          placeholder="Що шукаєте?"
          className="h-11 w-full min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <Button type="submit">Знайти</Button>
      </form>

      {categories.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">Популярні категорії</p>
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category=${c.id}`}
                className="rounded-full bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-opacity hover:opacity-80 dark:bg-gray-800 dark:text-brand-400"
              >
                {c.nameUk}
              </Link>
            ))}
          </div>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block">
        <Button variant="secondary">На головну</Button>
      </Link>
    </div>
  );
}
