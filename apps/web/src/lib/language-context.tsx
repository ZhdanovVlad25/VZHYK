'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translations, type Language, type TranslationKey } from './i18n';

const STORAGE_KEY = 'vzhyk.lang';
const DEFAULT_LANGUAGE: Language = 'uk';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  /** Перекладає ключ; для сторінок, які ще не переведені (більшість сайту), просто нема сенсу — текст там завжди українською. */
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'uk' || stored === 'ru') {
        setLanguageState(stored);
      }
    } catch {
      // localStorage недоступний (приватний режим тощо) — лишаємось на дефолтній укр.
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // те саме — не критично, просто не запам'ятається між сесіями.
    }
  }, []);

  const t = useCallback((key: TranslationKey) => translations[language][key], [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage() має використовуватись всередині <LanguageProvider>');
  }
  return ctx;
}
