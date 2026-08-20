import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, type ColorScheme } from './theme';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'vzhyk.theme';

interface ThemeContextValue {
  theme: ThemeMode;
  colors: ColorScheme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** RN-порт apps/web/src/lib/theme-context.tsx — light/dark клас на <html> тут замінює colors-об'єкт з хука. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<ThemeMode>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const colors = theme === 'dark' ? darkColors : lightColors;
  const value = useMemo<ThemeContextValue>(() => ({ theme, colors, toggleTheme }), [theme, colors, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() має використовуватись всередині <ThemeProvider>');
  }
  return ctx;
}
