'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AuthUser,
  getMe,
  getMyProfile,
  requestOtp as apiRequestOtp,
  setUnauthorizedHandler,
  verifyOtp as apiVerifyOtp,
} from './api';

const STORAGE_KEY = 'vzhyk.auth';

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  displayName: string | null;
  avatarUrl: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  isLoading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  /** needsName/needsPhone — профіль ще без імені/номера, сторінка логіну показує додаткові кроки. */
  verifyOtp: (phone: string, code: string) => Promise<{ needsName: boolean; needsPhone: boolean }>;
  /** Google OAuth callback віддає лише токени в query — user підвантажується окремо через GET /auth/me. */
  loginWithTokens: (accessToken: string, refreshToken: string) => Promise<{ needsName: boolean; needsPhone: boolean }>;
  setDisplayName: (name: string) => void;
  setAvatarUrl: (url: string | null) => void;
  /** Викликається після успішної прив'язки номера (POST /auth/phone/link) — оновлює user.phone у сховищі. */
  setPhone: (phone: string) => void;
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
    const profile = await getMyProfile(tokens.accessToken).catch(() => null);
    const stored: StoredAuth = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: tokens.user,
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setAuth(stored);
    return { needsName: !stored.displayName, needsPhone: !stored.user.phone };
  }, []);

  const loginWithTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    const me = await getMe(accessToken);
    const profile = await getMyProfile(accessToken).catch(() => null);
    const stored: StoredAuth = {
      accessToken,
      refreshToken,
      user: { id: me.id, role: me.role, phone: me.phone },
      displayName: profile?.displayName ?? null,
      avatarUrl: profile?.avatarUrl ?? null,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setAuth(stored);
    return { needsName: !stored.displayName, needsPhone: !stored.user.phone };
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, displayName: name };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setAvatarUrl = useCallback((url: string | null) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatarUrl: url };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPhone = useCallback((phone: string) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, phone } };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuth(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      accessToken: auth?.accessToken ?? null,
      displayName: auth?.displayName ?? null,
      avatarUrl: auth?.avatarUrl ?? null,
      isLoading,
      requestOtp,
      verifyOtp,
      loginWithTokens,
      setDisplayName,
      setAvatarUrl,
      setPhone,
      logout,
    }),
    [auth, isLoading, requestOtp, verifyOtp, loginWithTokens, setDisplayName, setAvatarUrl, setPhone, logout],
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
