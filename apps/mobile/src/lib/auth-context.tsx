import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AuthUser,
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
  /** Повертає true, якщо профіль ще без імені — LoginScreen показує додатковий крок. */
  verifyOtp: (phone: string, code: string) => Promise<{ needsName: boolean }>;
  setDisplayName: (name: string) => void;
  setAvatarUrl: (url: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function readStoredAuth(): Promise<StoredAuth | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    await SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
    return null;
  }
}

/**
 * Токен живе лише в SecureStore (шифроване сховище ОС) — той самий підхід, що
 * localStorage у web-версії (apps/web/src/lib/auth-context.tsx), просто безпечніший
 * носій. Немає /auth/refresh на бекенді в цьому зрізі — сесія природно завершується
 * через 15 хв (TTL access token), без автопродовження.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readStoredAuth().then((stored) => {
      setAuth(stored);
      setIsLoading(false);
    });
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
    // Бекенд код уже прийняв (OTP consumedAt виставлено) — якщо запис у SecureStore впаде
    // (сховище недоступне, диск повний), успішний логін не повинен перетворюватись на
    // "невірний код": сесія лишається в пам'яті на поточний запуск, просто не переживе рестарт.
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(stored)).catch(() => {});
    setAuth(stored);
    return { needsName: !stored.displayName };
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, displayName: name };
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setAvatarUrl = useCallback((url: string | null) => {
    setAuth((prev) => {
      if (!prev) return prev;
      const next = { ...prev, avatarUrl: url };
      SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    SecureStore.deleteItemAsync(STORAGE_KEY).catch(() => {});
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
      setDisplayName,
      setAvatarUrl,
      logout,
    }),
    [auth, isLoading, requestOtp, verifyOtp, setDisplayName, setAvatarUrl, logout],
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
