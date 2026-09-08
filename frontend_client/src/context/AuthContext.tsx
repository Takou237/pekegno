import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/api/auth.api';
import { getStoredToken, setStoredToken, registerUnauthorizedHandler } from '@/api/client';
import type { User } from '@/types';
import { useToast } from '@/context/ToastContext';

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const { showToast } = useToast();

  const refreshUser = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user ?? data);
    } catch {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      showToast('Session expirée, veuillez vous reconnecter.', 'warning');
    });

    const token = getStoredToken();
    if (token) {
      refreshUser().finally(() => setIsInitializing(false));
    } else {
      setIsInitializing(false);
    }
  }, [refreshUser, showToast]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setStoredToken(res.token);
    setUser(res.user);
    refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (payload: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string }) => {
    await authApi.register(payload);
    const res = await authApi.login(payload.email, payload.password);
    setStoredToken(res.token);
    setUser(res.user);
    refreshUser();
  }, [refreshUser]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setStoredToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isInitializing, isAuthenticated: Boolean(user), login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
