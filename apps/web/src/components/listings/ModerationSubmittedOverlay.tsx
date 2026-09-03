'use client';

import { Button } from '@/components/ui';

interface ModerationSubmittedOverlayProps {
  onContinue: () => void;
}

/**
 * Повноекранне підтвердження одразу після відправки оголошення на модерацію.
 * Раніше єдиним сигналом був малий інлайн-банер угорі сторінки — на довгій формі його
 * не було видно без скролу (звіт тестувальника: "натиснув зберігати внизу і нічого").
 */
export function ModerationSubmittedOverlay({ onContinue }: ModerationSubmittedOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 text-center dark:bg-gray-950">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
        <svg viewBox="0 0 24 24" fill="none" className="h-10 w-10 text-brand-600 dark:text-brand-400" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">Надіслано на модерацію</h1>
      <p className="mb-8 max-w-sm text-sm text-gray-600 dark:text-gray-400">
        Оголошення перевірить модератор — зазвичай це займає недовго. Після схвалення воно з&apos;явиться в пошуку.
      </p>
      <Button onClick={onContinue}>Перейти до оголошення</Button>
    </div>
  );
}
