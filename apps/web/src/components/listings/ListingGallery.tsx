'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import type { Media } from '@/lib/api';

interface ListingGalleryProps {
  media: Media[];
  title: string;
}

/** Основне фото зі стрілками-перемикачами + мініатюри + повноекранний перегляд (клік/кнопка "Збільшити"). */
export function ListingGallery({ media, title }: ListingGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  const goPrev = () => setActiveIndex((i) => (i - 1 + media.length) % media.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % media.length);

  useEffect(() => {
    if (!isZoomed) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsZoomed(false);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goPrev/goNext замикають media.length, стабільний за життя компонента
  }, [isZoomed]);

  if (media.length === 0) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 sm:aspect-square">
        <div className="flex h-full w-full items-center justify-center text-sm text-gray-400 dark:text-gray-500">Без фото</div>
      </div>
    );
  }

  const active = media[activeIndex];

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800 sm:aspect-square">
        <Image
          src={active.url}
          alt={`${title} — фото ${activeIndex + 1} з ${media.length}`}
          fill
          priority
          sizes="(min-width: 768px) 50vw, 100vw"
          className="object-cover"
        />
        {media.length > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              aria-label="Попереднє фото"
              // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: h-9/w-9=36px).
              className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-gray-700 shadow hover:bg-white"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Наступне фото"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-gray-700 shadow hover:bg-white"
            >
              ›
            </button>
            <span className="absolute bottom-2 left-2 rounded-lg bg-black/50 px-2 py-0.5 text-xs text-white">
              {activeIndex + 1}/{media.length}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setIsZoomed(true)}
          // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: py-1.5 ≈ 28px висоти).
          className="absolute bottom-2 right-2 flex min-h-[44px] items-center justify-center rounded-lg bg-white/90 px-3 text-xs font-medium text-gray-700 shadow hover:bg-white"
        >
          Збільшити
        </button>
      </div>

      {media.length > 1 && (
        <div className="mt-2 grid grid-cols-4 gap-2">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Фото ${i + 1}`}
              aria-current={i === activeIndex}
              className={cn(
                'relative aspect-square w-full overflow-hidden rounded-xl border',
                i === activeIndex ? 'border-brand-600 ring-2 ring-brand-200' : 'border-gray-200 dark:border-gray-700',
              )}
            >
              {/* MUST-аудит "9 з 12 зображень без alt": alt="" тут раніше — не декоративне,
                  це справжнє фото товару (кнопка-обгортка вже має aria-label для скрін-рідерів,
                  цей alt — для Google Images/SEO, який не бачить aria-label). */}
              <Image src={m.url} alt={`${title} — фото ${i + 1} з ${media.length}`} fill sizes="25vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {isZoomed &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Фото: ${title}`}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setIsZoomed(false)}
          >
            <button
              type="button"
              onClick={() => setIsZoomed(false)}
              aria-label="Закрити"
              // 44px — мінімальна рекомендована зона дотику для пальця (аудит 27.08: h-10/w-10=40px).
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
            >
              ✕
            </button>
            <div className="relative h-full max-h-[85vh] w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
              <Image
                src={active.url}
                alt={`${title} — фото ${activeIndex + 1} з ${media.length}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
            </div>
            {media.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label="Попереднє фото"
                  className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Наступне фото"
                  className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl text-white hover:bg-white/20"
                >
                  ›
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
