'use client';

import { useEffect, useState } from 'react';
import { Toggle } from '@/components/ui';

const DISMISS_KEY = 'vzhyk:autorenew-tip-dismissed';

interface AutoRenewToggleProps {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** Тумблер "Автопродовження" на сторінці редагування — показує спливаючу підказку про 30-денний термін один раз (потім запам'ятовує в localStorage). */
export function AutoRenewToggle({ checked, disabled, onChange }: AutoRenewToggleProps) {
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(DISMISS_KEY)) setShowTip(true);
    } catch {
      // localStorage недоступний (приватний режим тощо) — просто без підказки
    }
  }, []);

  function dismissTip() {
    setShowTip(false);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    // Не absolute — підказка мусить займати місце в потоці й відштовхувати кнопки
    // "Опублікувати"/"Зберегти" нижче, інакше вона просто лягає поверх них (аудит: скріншот
    // з мобільного показав підказку, що перекриває "Опублікувати").
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100">Автопродовження</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {checked
              ? 'Оголошення автоматично продовжуватиметься після закінчення терміну дії.'
              : 'Відображення оголошення не буде автоматично продовжуватись по закінченню строку його дії.'}
          </p>
        </div>
        <Toggle checked={checked} disabled={disabled} onChange={onChange} />
      </div>

      {showTip && (
        <div className="relative rounded-xl bg-brand-900 p-4 text-sm text-white shadow-lg">
          <span className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 bg-brand-900" aria-hidden="true" />
          <p>Оголошення активні протягом 30 днів, але ви можете продовжувати їх скільки завгодно.</p>
          <button
            type="button"
            onClick={dismissTip}
            className="ml-auto mt-3 block text-xs font-semibold uppercase tracking-wide text-white/90 hover:text-white"
          >
            ОК, зрозуміло
          </button>
        </div>
      )}
    </div>
  );
}
