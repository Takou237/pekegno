import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { authApi } from '@/api/auth.api';
import {
  getStoredToken,
  registerForbiddenHandler,
  registerUnauthorizedHandler,
  setStoredToken,
} from '@/api/client';
import { useToast } from '@/hooks/useToast';
import {
  requiresTwoFactor,
  type LoginCredentials,
  type RegisterPayload,
  type User,
} from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  pendingTwoFactorToken: string | null;
  login: (credentials: LoginCredentials) => Promise<{ requiresTwoFactor: boolean }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  cancelTwoFactorChallenge: () => void;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(
    null
  );
  const { showToast } = useToast();
  const { t } = useTranslation();

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setPendingTwoFactorToken(null);
  }, []);

  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      setIsInitializing(false);
      return;
    }

    authApi
      .me()
      .then(setUser)
      .catch((error) => {
        if (error?.response?.status === 401) {
          clearSession();
        }
      })
      .finally(() => setIsInitializing(false));
  }, [clearSession]);

  useEffect(() => {
    registerUnauthorizedHandler((reason) => {
      const hadSession = user !== null;
      clearSession();
      if (hadSession) {
        showToast(
          reason === 'expired' ? t('session.expired') : t('session.invalid'),
          'warning'
        );
      }
    });

    registerForbiddenHandler(() => {
      showToast(t('session.forbidden'), 'error');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSession, showToast, user, t]);

  const login = useCallback<AuthContextValue['login']>(async (credentials) => {
    const response = await authApi.login(credentials);

    if (requiresTwoFactor(response)) {
      setPendingTwoFactorToken(response.temp_token);
      return { requiresTwoFactor: true };
    }

    setStoredToken(response.token);
    setUser(response.user);
    return { requiresTwoFactor: false };
  }, []);

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      if (!pendingTwoFactorToken) {
        throw new Error(t('session.twoFactorPending'));
      }

      const response = await authApi.twoFactorLogin({
        temp_token: pendingTwoFactorToken,
        code,
      });

      setStoredToken(response.token);
      setUser(response.user);
      setPendingTwoFactorToken(null);
    },
    [pendingTwoFactorToken, t]
  );

  const cancelTwoFactorChallenge = useCallback(() => {
    setPendingTwoFactorToken(null);
  }, []);

  // F2 : le backend renvoie un token valide sur /auth/register, mais le
  // parcours attendu (TASKS_AUTHENTICATION.md) est une redirection vers
  // /login après inscription plutôt qu'une connexion automatique.
  const register = useCallback<AuthContextValue['register']>(async (payload) => {
    await authApi.register(payload);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const refreshUser = useCallback(async () => {
    const freshUser = await authApi.me();
    setUser(freshUser);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      isAuthenticated: user !== null,
      pendingTwoFactorToken,
      login,
      verifyTwoFactor,
      cancelTwoFactorChallenge,
      register,
      logout,
      refreshUser,
    }),
    [
      user,
      isInitializing,
      pendingTwoFactorToken,
      login,
      verifyTwoFactor,
      cancelTwoFactorChallenge,
      register,
      logout,
      refreshUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
