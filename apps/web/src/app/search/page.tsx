'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  search,
  createSavedSearch,
  getCities,
  getCategoryTree,
  ApiError,
  type City,
  type SearchResultItem,
  type SearchParams,
} from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { pluralizeListings } from '@/lib/format';
import { getListingTypeOptions } from '@/lib/listing-type';
import { ListingCard } from '@/components/listings/ListingCard';
import { Button, Dropdown, EmptyState, ErrorState, Input, LoadingState } from '@/components/ui';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Спочатку нові' },
  { value: 'relevance', label: 'За релевантністю' },
  { value: 'price_asc', label: 'Дешевші спочатку' },
  { value: 'price_desc', label: 'Дорожчі спочатку' },
];

const CONDITION_OPTIONS = [
  { value: 'new', label: 'Новий' },
  { value: 'used', label: 'Вживаний' },
  { value: 'for_parts', label: 'На запчастини' },
];

function sanitizeNonNegative(raw: string): string {
  return raw.replace(/-/g, '');
}

/** useSearchParams() вимагає Suspense-межу в App Router, інакше build падає на prerender. */
export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState label="Завантаження…" />}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const urlParams = useSearchParams();
  const q = urlParams.get('q') ?? '';
  const category = urlParams.get('category') ?? undefined;
  const seller = urlParams.get('seller') ?? undefined;
  const location = urlParams.get('location') ?? undefined;
  const urlPriceMin = urlParams.get('priceMin') ?? '';
  const urlPriceMax = urlParams.get('priceMax') ?? '';
  const urlCondition = urlParams.get('condition') ?? '';
  const urlListingType = urlParams.get('listingType') ?? '';
  const { user, accessToken } = useAuth();

  const [sort, setSort] = useState<SearchParams['sort']>(q ? 'relevance' : 'newest');
  const [items, setItems] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [saveSearchMessage, setSaveSearchMessage] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Локальний стан полів фільтрів — окремо від URL, бо ціна набирається посимвольно
  // (URL оновлюємо лише при сабміті/зміні дропдауна, не на кожне натискання клавіші).
  const [priceMin, setPriceMin] = useState(urlPriceMin);
  const [priceMax, setPriceMax] = useState(urlPriceMax);
  const [cities, setCities] = useState<City[]>([]);

  useEffect(() => {
    setPriceMin(urlPriceMin);
    setPriceMax(urlPriceMax);
  }, [urlPriceMin, urlPriceMax]);

  useEffect(() => {
    getCities().then(setCities).catch(() => setCities([]));
  }, []);

  // Аудит 27.08: перехід на "Авто" показував <title>/<h1> "Усі оголошення"/"Пошук
  // оголошень" незалежно від категорії — сторінка "не знала, яка вона категорія".
  // Клієнтський компонент не може генерувати повний ЧПУ-маршрут (/avto/dnipro) без
  // окремого дерева server-роутів — тут мінімально виправлено title/h1/meta description
  // під конкретну категорію, лишаючись на тому самому ?category=UUID URL.
  const [categoryName, setCategoryName] = useState<string | null>(null);
  // categorySlug — потрібен окремо від categoryName для category-aware "Тип оголошення"
  // (вакансія/резюме на "Роботі" замість продаю/куплю/...), той самий helper, що в формі подання.
  const [categorySlug, setCategorySlug] = useState<string | null>(null);
  useEffect(() => {
    if (!category) {
      setCategoryName(null);
      setCategorySlug(null);
      return;
    }
    let cancelled = false;
    getCategoryTree(300)
      .then((tree) => {
        if (cancelled) return;
        for (const top of tree) {
          if (top.id === category) {
            setCategoryName(top.nameUk);
            setCategorySlug(top.slug);
            return;
          }
          const child = top.children.find((c) => c.id === category);
          if (child) {
            setCategoryName(child.nameUk);
            setCategorySlug(child.slug);
            return;
          }
        }
        setCategoryName(null);
        setCategorySlug(null);
      })
      .catch(() => {
        if (cancelled) return;
        setCategoryName(null);
        setCategorySlug(null);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  const pageTitle = seller
    ? 'Оголошення продавця'
    : q
      ? `«${q}»`
      : categoryName ?? 'Усі оголошення';

  useEffect(() => {
    document.title = `${pageTitle} — Вжик`;
    return () => {
      document.title = 'Вжик — оголошення';
    };
  }, [pageTitle]);

  const priceMinNum = urlPriceMin ? Number(urlPriceMin) : undefined;
  const priceMaxNum = urlPriceMax ? Number(urlPriceMax) : undefined;
  const condition = urlCondition || undefined;
  const listingType = urlListingType || undefined;

  const activeFilterCount = [location, priceMinNum, priceMaxNum, condition, listingType].filter(
    (v) => v !== undefined,
  ).length;

  function buildUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams(urlParams.toString());
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    return `/search${params.toString() ? `?${params.toString()}` : ''}`;
  }

  function applyPriceFilter() {
    router.push(buildUrl({ priceMin: priceMin || undefined, priceMax: priceMax || undefined }));
  }

  function applyConditionFilter(value: string | null) {
    router.push(buildUrl({ condition: value ?? undefined }));
  }

  function applyListingTypeFilter(value: string | null) {
    router.push(buildUrl({ listingType: value ?? undefined }));
  }

  function applyLocationFilter(value: string | null) {
    router.push(buildUrl({ location: value ?? undefined }));
  }

  function resetFilters() {
    router.push(
      buildUrl({ location: undefined, priceMin: undefined, priceMax: undefined, condition: undefined, listingType: undefined }),
    );
  }

  const runSearch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await search({
        q: q || undefined,
        category,
        seller,
        location,
        priceMin: priceMinNum,
        priceMax: priceMaxNum,
        condition,
        listingType,
        sort,
      });
      setItems(result.items);
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити результати пошуку.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- priceMinNum/priceMaxNum/condition/listingType похідні від urlParams, вже покриті нижче
  }, [q, category, seller, location, priceMinNum, priceMaxNum, condition, listingType, sort]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  async function loadMore() {
    if (!nextCursor) return;
    setIsLoadingMore(true);
    try {
      const result = await search({
        q: q || undefined,
        category,
        seller,
        location: location ?? undefined,
        priceMin: priceMinNum,
        priceMax: priceMaxNum,
        condition,
        listingType,
        sort,
        cursor: nextCursor,
      });
      setItems((prev) => [...prev, ...result.items]);
      setNextCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не вдалося завантажити ще оголошення.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function saveSearch() {
    if (!accessToken) return;
    setIsSavingSearch(true);
    setSaveSearchMessage(null);
    try {
      await createSavedSearch({ queryText: q || undefined, categoryId: category, filters: sort ? { sort } : undefined }, accessToken);
      setSaveSearchMessage('Пошук збережено');
    } catch (err) {
      setSaveSearchMessage(err instanceof ApiError ? err.message : 'Не вдалося зберегти пошук.');
    } finally {
      setIsSavingSearch(false);
    }
  }

  const hasFilters = Boolean(q || category || seller || location);
  const cityOptions = useMemo(() => cities.map((c) => ({ value: c.id, label: c.nameUk })), [cities]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Link
              href="/"
              aria-label="Назад до категорій"
              title="Назад до категорій"
              // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: h-9/w-9=36px).
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-700 dark:hover:bg-gray-700 dark:hover:text-brand-400"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
          )}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {seller ? (
                'Оголошення продавця'
              ) : q ? (
                <>
                  Результати пошуку: <span className="text-brand-600 dark:text-brand-400">«{q}»</span>
                </>
              ) : (
                categoryName ?? 'Усі оголошення'
              )}
            </h1>
            {!isLoading && !error && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Знайдено {total} {pluralizeListings(total)}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {user && (q || category) && (
            <div className="flex flex-col items-end gap-1">
              <Button variant="secondary" size="sm" isLoading={isSavingSearch} onClick={saveSearch}>
                Зберегти пошук
              </Button>
              {saveSearchMessage && <span className="text-xs text-gray-500 dark:text-gray-400">{saveSearchMessage}</span>}
            </div>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            Фільтри{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Button>
          <div className="w-56">
            <Dropdown
              label="Сортування"
              options={SORT_OPTIONS}
              value={sort ?? 'newest'}
              onChange={(value) => setSort(value as SearchParams['sort'])}
            />
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900 sm:grid-cols-2 lg:grid-cols-4">
          <Dropdown
            label="Місто"
            options={cityOptions}
            value={location ?? null}
            onChange={applyLocationFilter}
            placeholder="Будь-яке"
          />
          <Dropdown
            label="Стан"
            options={CONDITION_OPTIONS}
            value={condition ?? null}
            onChange={applyConditionFilter}
            placeholder="Будь-який"
          />
          <Dropdown
            label="Тип оголошення"
            options={getListingTypeOptions(categorySlug)}
            value={listingType ?? null}
            onChange={applyListingTypeFilter}
            placeholder="Будь-який"
          />
          {/* MUST-аудит: "Скинути фільтри" лежала поверх "Ціна до" — <input> безw-full
              бере природну (~192px) ширину браузера, дві такі поруч ширші за grid-колонку
              на sm:grid-cols-2 і вилазять у сусідню клітинку. min-w-0 на самому flex-контейнері
              (grid-айтем за замовчуванням теж min-width:auto) + flex-1/w-full на кожному
              полі дає їм справді стиснутись під колонку. */}
          <div className="flex min-w-0 items-end gap-2">
            <div className="min-w-0 flex-1">
              <Input
                label="Ціна від"
                type="number"
                min={0}
                value={priceMin}
                onChange={(e) => setPriceMin(sanitizeNonNegative(e.target.value))}
                onBlur={applyPriceFilter}
                className="w-full"
              />
            </div>
            <div className="min-w-0 flex-1">
              <Input
                label="Ціна до"
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => setPriceMax(sanitizeNonNegative(e.target.value))}
                onBlur={applyPriceFilter}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilterCount === 0}>
              Скинути фільтри
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState label="Шукаємо оголошення…" />
      ) : error ? (
        <ErrorState description={error} onRetry={runSearch} />
      ) : items.length === 0 ? (
        <EmptyState title="Нічого не знайдено" description="Спробуйте змінити запит або фільтри." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
            {items.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
          {nextCursor && (
            <div className="mt-6 flex justify-center">
              <Button variant="secondary" isLoading={isLoadingMore} onClick={loadMore}>
                Завантажити ще
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
