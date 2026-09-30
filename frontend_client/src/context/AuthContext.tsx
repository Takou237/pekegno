import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '@/api/auth.api';
import { getStoredToken, setStoredToken, registerUnauthorizedHandler } from '@/api/client';
import { isTwoFactorChallenge, type User } from '@/types';
import { useToast } from '@/context/ToastContext';

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  /** Défi 2FA en cours (temp_token) — l'utilisateur doit saisir le code reçu par email. */
  pendingTwoFactorToken: string | null;
  login: (email: string, password: string) => Promise<{ requiresTwoFactor: boolean }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  cancelTwoFactorChallenge: () => void;
  register: (payload: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string; phone?: string; city?: string; country?: string }) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(null);
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

    // Compte protégé par 2FA : un code vient d'être envoyé par email.
    // On reste sur l'écran de connexion pour saisir le code.
    if (isTwoFactorChallenge(res)) {
      setPendingTwoFactorToken(res.temp_token);
      return { requiresTwoFactor: true };
    }

    setStoredToken(res.token);
    setUser(res.user);
    refreshUser();
    return { requiresTwoFactor: false };
  }, [refreshUser]);

  const verifyTwoFactor = useCallback(async (code: string) => {
    if (!pendingTwoFactorToken) {
      throw new Error('Aucune vérification en attente.');
    }

    const res = await authApi.twoFactorLogin(pendingTwoFactorToken, code);

    setStoredToken(res.token);
    setUser(res.user);
    setPendingTwoFactorToken(null);
    refreshUser();
  }, [pendingTwoFactorToken, refreshUser]);

  const cancelTwoFactorChallenge = useCallback(() => {
    setPendingTwoFactorToken(null);
  }, []);

  const register = useCallback(async (payload: { first_name: string; last_name: string; email: string; password: string; password_confirmation: string; phone?: string; city?: string; country?: string }) => {
    await authApi.register(payload);
    const res = await authApi.login(payload.email, payload.password);

    // Un compte fraîchement créé n'a pas de 2FA : connexion directe.
    if (isTwoFactorChallenge(res)) {
      setPendingTwoFactorToken(res.temp_token);
      return;
    }

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
      setPendingTwoFactorToken(null);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isInitializing,
        isAuthenticated: Boolean(user),
        pendingTwoFactorToken,
        login,
        verifyTwoFactor,
        cancelTwoFactorChallenge,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
