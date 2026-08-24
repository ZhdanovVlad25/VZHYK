'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { getCities, type City } from '@/lib/api';
import { Logo } from './Logo';
import { ProfileMenu } from './ProfileMenu';
import { AdminMenu } from './AdminMenu';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [cities, setCities] = useState<City[]>([]);
  const [location, setLocation] = useState<string | null>(null);
  // md+ рендерить свою власну (не-мобільну) навігацію інлайн — цей стан лише для <md drawer.
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  // Перехід між сторінками (клік лінка в мобільному меню) — закриваємо drawer, інакше
  // лишається розкритим поверх нової сторінки.
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  function navigateToSearch(nextQ: string, nextLocation: string | null) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set('q', nextQ.trim());
    if (nextLocation) params.set('location', nextLocation);
    router.push(`/search${params.toString() ? `?${params.toString()}` : ''}`);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    navigateToSearch(q, location);
    setIsMenuOpen(false);
  }

  function handleLocationChange(value: string | null) {
    setLocation(value);
    navigateToSearch(q, value);
  }

  // idSuffix — форма рендериться двічі (десктоп-рядок + мобільний drawer), id/htmlFor мають
  // лишатись унікальними в DOM.
  function renderSearchForm(idSuffix: string) {
    return (
      <form onSubmit={handleSearch} role="search" className="flex w-full items-center gap-2">
        <label htmlFor={`header-search-${idSuffix}`} className="sr-only">
          Пошук оголошень
        </label>
        <input
          id={`header-search-${idSuffix}`}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="h-9 w-full min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
        />
        <select
          aria-label={t('cityLabel')}
          value={location ?? ''}
          onChange={(e) => handleLocationChange(e.target.value || null)}
          className="h-9 w-24 shrink-0 rounded-xl border border-gray-300 bg-white px-2 text-sm text-gray-900 focus-visible:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:w-28"
        >
          <option value="">{t('allCities')}</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nameUk}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="shrink-0">
          {t('searchButton')}
        </Button>
      </form>
    );
  }

  // Другорядне (мова/тема/адмінка) — на md+ інлайн у хедері, на <md усередині drawer.
  // "Додати оголошення"/"Увійти" сюди навмисно НЕ входять — вони окремо, завжди видимі
  // (renderCallToAction), інакше на <md дублювались би: і в постійному рядку, і в drawer.
  function renderNavItems(): ReactNode {
    return (
      <>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <ThemeToggle />
        </div>

        {!isLoading && user && (user.role === 'moderator' || user.role === 'admin') && <AdminMenu role={user.role} />}
      </>
    );
  }

  // Головні дії — завжди видимі (і на md+ інлайн, і на <md у постійному рядку зверху,
  // поза drawer). /listings/new сама показує "увійдіть" з лінком на /login, якщо юзера нема.
  function renderCallToAction(): ReactNode {
    return (
      <>
        <Link href="/listings/new" className="md:w-auto">
          <Button variant="accent" size="sm" className="w-full md:w-auto">
            {t('addListing')}
          </Button>
        </Link>
        {!isLoading && !user && (
          <Link href="/login" className="md:w-auto">
            <Button variant="secondary" size="sm" className="w-full md:w-auto">
              {t('login')}
            </Button>
          </Link>
        )}
      </>
    );
  }

  return (
    <header className="shrink-0 border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-3">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2 font-display text-xl font-extrabold text-brand-700 dark:text-brand-400">
            <Logo className="h-7 w-7" />
            <span className="hidden sm:inline">Вжик</span>
          </Link>

          {/* Пошук: своя строка на <md (нижче), інлайн поряд з лого на md+. */}
          <div className="hidden min-w-[200px] flex-1 md:flex">{renderSearchForm('desktop')}</div>

          {/* Тогли/nav/акаунт інлайн лише на md+ — на <md усе це переїжджає в drawer нижче. */}
          <div className="hidden shrink-0 items-center gap-3 md:flex">
            {renderNavItems()}
            {renderCallToAction()}
          </div>

          {/* Головні дії на <md — завжди видимі, поза drawer. Займають простір, де на md+
              була б форма пошуку. */}
          <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">{renderCallToAction()}</div>

          {/* Профіль лишається видимим завжди (навіть на <md) — вже компактний (аватар+ім'я),
              не варто ховати за гамбургер разом з рештою. */}
          {user && (
            <div className="shrink-0 md:hidden">
              <ProfileMenu />
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Закрити меню' : 'Відкрити меню'}
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 text-gray-700 md:hidden dark:border-gray-700 dark:text-gray-300"
          >
            {isMenuOpen ? (
              <span className="text-xl leading-none">×</span>
            ) : (
              <span className="flex flex-col gap-[3px]">
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
              </span>
            )}
          </button>

          {/* ProfileMenu на md+ живе всередині renderNavItems-сусіда, а не тут — рендеримо
              окремо праворуч від навігації тим самим порядком, що й раніше. */}
          {user && (
            <div className="hidden shrink-0 md:block">
              <ProfileMenu />
            </div>
          )}
        </div>

        {/* Мобільний пошук — завжди видимий одразу під верхньою строкою, не ховається в drawer
            (пошук — основна дія маркетплейсу, не другорядна навігація). */}
        <div className="mt-3 md:hidden">{renderSearchForm('mobile')}</div>

        {isMenuOpen && (
          <div className="mt-3 flex flex-col items-stretch gap-3 border-t border-gray-100 pt-3 md:hidden dark:border-gray-800">
            {renderNavItems()}
          </div>
        )}
      </div>
    </header>
  );
}
