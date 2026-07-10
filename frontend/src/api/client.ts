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
 * Callback branché par AuthContext (useAuth) pour réagir globalement à une
 * session invalide, sans créer de dépendance circulaire entre le client
 * Axios et le contexte React.
 */
let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

/**
 * NOTE IMPORTANTE (Sanctum ne fait pas de vrai refresh token) :
 * Laravel Sanctum délivre des tokens Bearer opaques sans expiration ni
 * mécanisme de refresh natif. On ne peut donc pas "rafraîchir" un token côté
 * front. Ce qu'on peut faire :
 *  - détecter tout 401 (token invalide, révoqué par EnsureSingleSession
 *    suite à une connexion ailleurs, ou session expirée pour inactivité)
 *  - nettoyer l'état local et rediriger proprement vers /login
 * Si Dev1 ajoute un vrai refresh token plus tard, on branchera ici une
 * tentative de refresh avant de déclencher onUnauthorized.
 */
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      setStoredToken(null);
      onUnauthorized?.();
    }
    return Promise.reject(error);
  }
);
