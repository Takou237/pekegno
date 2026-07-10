import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/api/auth.api';
import {
  getStoredToken,
  registerUnauthorizedHandler,
  setStoredToken,
} from '@/api/client';
import {
  requiresTwoFactor,
  type LoginCredentials,
  type RegisterPayload,
  type TwoFactorVerifyPayload,
  type User,
} from '@/types/auth';

interface AuthContextValue {
  user: User | null;
  /** true tant qu'on n'a pas fini de vérifier une session existante au chargement */
  isInitializing: boolean;
  isAuthenticated: boolean;
  /** rempli quand /auth/login renvoie un défi 2FA, en attente de vérification */
  pendingTwoFactorToken: string | null;
  login: (credentials: LoginCredentials) => Promise<{ requiresTwoFactor: boolean }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [pendingTwoFactorToken, setPendingTwoFactorToken] = useState<string | null>(
    null
  );

  const clearSession = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    setPendingTwoFactorToken(null);
  }, []);

  // Si un token est déjà stocké (rechargement de page), on tente de
  // récupérer l'utilisateur courant pour restaurer la session.
  useEffect(() => {
    const token = getStoredToken();

    if (!token) {
      setIsInitializing(false);
      return;
    }

    authApi
      .me()
      .then(setUser)
      .catch(() => clearSession())
      .finally(() => setIsInitializing(false));
  }, [clearSession]);

  // Le client Axios appelle ce handler dès qu'une requête renvoie 401
  // (token révoqué par EnsureSingleSession, session expirée, etc.)
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      clearSession();
    });
  }, [clearSession]);

  const login = useCallback<AuthContextValue['login']>(async (credentials) => {
    const response = await authApi.login(credentials);

    if (requiresTwoFactor(response)) {
      setPendingTwoFactorToken(response.two_factor_token);
      return { requiresTwoFactor: true };
    }

    setStoredToken(response.token);
    setUser(response.user);
    return { requiresTwoFactor: false };
  }, []);

  const verifyTwoFactor = useCallback(
    async (code: string) => {
      if (!pendingTwoFactorToken) {
        throw new Error('Aucune vérification 2FA en attente.');
      }

      const payload: TwoFactorVerifyPayload = {
        two_factor_token: pendingTwoFactorToken,
        code,
      };
      const response = await authApi.verifyTwoFactor(payload);

      setStoredToken(response.token);
      setUser(response.user);
      setPendingTwoFactorToken(null);
    },
    [pendingTwoFactorToken]
  );

  const register = useCallback<AuthContextValue['register']>(async (payload) => {
    const response = await authApi.register(payload);
    setStoredToken(response.token);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isInitializing,
      isAuthenticated: user !== null,
      pendingTwoFactorToken,
      login,
      verifyTwoFactor,
      register,
      logout,
    }),
    [user, isInitializing, pendingTwoFactorToken, login, verifyTwoFactor, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
