import axios, { AxiosError } from 'axios';

const TOKEN_STORAGE_KEY = 'pekegno_token';

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    Accept: 'application/json',
  },
});

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

// Injecte le Bearer token Sanctum sur chaque requête sortante.
client.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Callbacks branchés par AuthContext / ToastContext pour réagir globalement
 * à une session invalide (401) ou un accès refusé (403), sans créer de
 * dépendance circulaire entre le client Axios et le reste de l'app.
 */
let onUnauthorized: ((reason: 'expired' | 'invalid') => void) | null = null;
let onForbidden: (() => void) | null = null;

export function registerUnauthorizedHandler(
  handler: (reason: 'expired' | 'invalid') => void
): void {
  onUnauthorized = handler;
}

export function registerForbiddenHandler(handler: () => void): void {
  onForbidden = handler;
}

/**
 * NOTE IMPORTANTE (Sanctum ne fait pas de vrai refresh token) :
 * Laravel Sanctum délivre des tokens Bearer opaques sans expiration ni
 * mécanisme de refresh natif. On ne peut donc pas "rafraîchir" un token côté
 * front. Ce qu'on peut faire :
 *  - détecter tout 401 (token invalide, révoqué par EnsureSingleSession
 *    suite à une connexion ailleurs, ou session expirée pour inactivité) et
 *    nettoyer l'état local + rediriger proprement vers /login
 *  - détecter tout 403 (policy backend refusée, ex. AgencyPolicy) et notifier
 *    l'utilisateur sans casser sa session
 */
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(getStoredToken());
      setStoredToken(null);
      onUnauthorized?.(hadToken ? 'expired' : 'invalid');
    }

    if (error.response?.status === 403) {
      onForbidden?.();
    }

    return Promise.reject(error);
  }
);
