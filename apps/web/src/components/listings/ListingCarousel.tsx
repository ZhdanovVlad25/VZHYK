'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { ListingCard } from './ListingCard';
import type { SearchResultItem } from '@/lib/api';

/** Лише для кількості крапок ("скільки екранів контенту") — фактична позиція скролу для
 * кожної крапки рахується від реального maxScroll (scrollWidth-clientWidth), не від
 * припущення "сторінка = повна ширина контейнера": реальний overflow тут набагато менший
 * (влазить майже DESKTOP_PER_PAGE+1 карток), тож розрахунок від clientWidth завжди давав 0. */
const DESKTOP_PER_PAGE = 4;

/** Горизонтальний скрол замість "Інші оголошення"/"Усі оголошення автора" переносом рядків — стрілки + крапки-пагінація замість штатного скролбару. */
export function ListingCarousel({ items }: { items: SearchResultItem[] }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activePage, setActivePage] = useState(0);
  // 0..1 позиція скролу — очі-пагінація "дивляться" в бік скролу (гейміфікація за проханням:
  // "нехай будуть як очі у вжика, рухались за об'явами коли листаєш").
  const [scrollFraction, setScrollFraction] = useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / DESKTOP_PER_PAGE));

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    function onScroll() {
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 0) {
        setActivePage(0);
        setScrollFraction(0);
        return;
      }
      const fraction = el.scrollLeft / maxScroll;
      setScrollFraction(fraction);
      setActivePage(Math.round(fraction * (pageCount - 1)));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pageCount]);

  function scrollToPage(page: number) {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    const fraction = pageCount > 1 ? page / (pageCount - 1) : 0;
    el.scrollTo({ left: fraction * maxScroll, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div ref={scrollerRef} className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth">
        {items.map((item) => (
          <div key={item.id} className="w-[45%] shrink-0 snap-start sm:w-[31%] lg:w-[calc(25%-0.75rem)]">
            <ListingCard item={item} />
          </div>
        ))}
      </div>

      {items.length > DESKTOP_PER_PAGE && (
        <>
          <button
            type="button"
            onClick={() => scrollToPage(Math.max(0, activePage - 1))}
            aria-label="Прокрутити ліворуч"
            // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: h-9/w-9=36px).
            className="absolute -left-4 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-700 shadow hover:bg-gray-50 md:flex"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => scrollToPage(Math.min(pageCount - 1, activePage + 1))}
            aria-label="Прокрутити праворуч"
            className="absolute -right-4 top-1/3 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-bold text-gray-700 shadow hover:bg-gray-50 md:flex"
          >
            ›
          </button>

          <div className="mt-3 flex justify-center gap-2">
            {Array.from({ length: pageCount }, (_, page) => (
              <button
                key={page}
                type="button"
                onClick={() => scrollToPage(page)}
                aria-label={`Сторінка ${page + 1}`}
                aria-current={page === activePage}
                // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: крапки
                // пагінації були h-2, 8×8px). Видимий вигляд крапки лишається малим — росте
                // лише клікабельна зона довкола (span всередині), як ThemeToggle/LanguageToggle.
                className="flex min-h-[44px] min-w-[44px] items-center justify-center"
              >
                {/* "Око вжика" — жовтий сокет (той самий highlight-400, що й лого) + чорна
                    зіниця, яка зсувається вбік під час свайпу каруселі (та сама scrollFraction
                    для всіх очей одразу — синхронний рух, наче вжик стежить за оголошеннями). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-md transition-colors',
                    page === activePage ? 'bg-highlight-500' : 'bg-highlight-400/50 hover:bg-highlight-400',
                  )}
                >
                  <span
                    className="block h-2 w-2 rounded-full bg-gray-900 transition-transform duration-150 ease-out"
                    style={{ transform: `translateX(${(scrollFraction - 0.5) * 6}px)` }}
                  />
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
