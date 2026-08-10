'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthUser, requestOtp as apiRequestOtp, verifyOtp as apiVerifyOtp } from './api';

const STORAGE_KEY = 'vzhyk.auth';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Токен живе лише в localStorage (без httpOnly cookie) — публічні сторінки (home/search/
 * listing detail) рендеряться на сервері анонімно, автентифіковані дані підвантажуються
 * лише в client-компонентах. Немає /auth/refresh на бекенді в цьому зрізі — сесія
 * природно завершується через 15 хв (TTL access token), без автопродовження.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setAuth(JSON.parse(raw) as StoredAuth);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setIsLoading(false);
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await apiRequestOtp(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const tokens = await apiVerifyOtp(phone, code);
    const stored: StoredAuth = { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, user: tokens.user };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setAuth(stored);
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      accessToken: auth?.accessToken ?? null,
      isLoading,
      requestOtp,
      verifyOtp,
      logout,
    }),
    [auth, isLoading, requestOtp, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() має використовуватись всередині <AuthProvider>');
  }
  return ctx;
}
