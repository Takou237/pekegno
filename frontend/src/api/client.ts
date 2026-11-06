import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /**
     * Ne pas déclencher le toast global « droits insuffisants » sur un 403 :
     * la page gère déjà l'erreur localement (état vide, message inline…).
     */
    silentForbidden?: boolean;
    /**
     * Cache navigateur des lectures (GET) : `false` pour toujours interroger
     * l'API, ou une durée en millisecondes à la place de la valeur par défaut.
     */
    cache?: boolean | number;
  }
}

// ---------------------------------------------------------------------------
// Cache navigateur des lectures (GET)
// ---------------------------------------------------------------------------
// Revenir sur une page déjà ouverte est instantané : la réponse d'un GET est
// gardée en mémoire quelques secondes. Garanties :
//  - toute écriture réussie (POST / PUT / PATCH / DELETE) vide tout le cache :
//    après une action, chaque page relit des données fraîches ;
//  - changement de session (connexion, déconnexion, 401) → cache vidé ;
//  - F5 recharge l'application → cache vidé ;
//  - deux appels identiques simultanés ne partent qu'une fois ;
//  - jamais de cache pour les fichiers (blob) ni pour /user et /auth/*.
// Le serveur garde en plus ses propres caches (statistiques, listes de
// référence), invalidés de la même façon côté API.
const GET_CACHE_TTL_MS = 30_000;
const NEVER_CACHED = [/^\/?user$/, /^\/?auth\//];

interface CacheEntry {
  expiresAt: number;
  response: AxiosResponse;
}

const responseCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<AxiosResponse>>();
let cacheGeneration = 0;

/** Vide le cache navigateur des lectures (écriture, changement de session…). */
export function clearApiCache(): void {
  responseCache.clear();
  inFlight.clear();
  cacheGeneration += 1;
}

function cacheKey(config: InternalAxiosRequestConfig): string | null {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return null;
  if (config.cache === false) return null;
  if (config.responseType && config.responseType !== 'json') return null;
  const url = config.url ?? '';
  if (NEVER_CACHED.some((re) => re.test(url))) return null;
  const params = config.params ? JSON.stringify(config.params, Object.keys(config.params).sort()) : '';
  return `${config.baseURL ?? ''}|${url}|${params}`;
}

/** Copie de la réponse : une page qui modifie `data` ne doit pas altérer le cache. */
function cloneResponse(response: AxiosResponse, config: InternalAxiosRequestConfig): AxiosResponse {
  return { ...response, config, data: structuredClone(response.data) };
}

const defaultAdapter: AxiosAdapter = axios.getAdapter(axios.defaults.adapter);

const cachingAdapter: AxiosAdapter = (config) => {
  const key = cacheKey(config);
  if (!key) return defaultAdapter(config);

  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cloneResponse(cached.response, config));
  }

  const pending = inFlight.get(key);
  if (pending) return pending.then((response) => cloneResponse(response, config));

  const ttl = typeof config.cache === 'number' ? config.cache : GET_CACHE_TTL_MS;
  const generation = cacheGeneration;
  const request = defaultAdapter(config)
    .then((response) => {
      // Une écriture a pu vider le cache pendant la requête : ne pas y remettre
      // une réponse lue avant cette écriture.
      if (generation === cacheGeneration && response.status >= 200 && response.status < 300) {
        responseCache.set(key, { expiresAt: Date.now() + ttl, response });
      }
      return response;
    })
    .finally(() => {
      if (inFlight.get(key) === request) inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request.then((response) => cloneResponse(response, config));
};

const TOKEN_STORAGE_KEY = 'pekegno_token';

export const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: {
    Accept: 'application/json',
  },
  adapter: cachingAdapter,
});

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  // Nouvelle session (ou fin de session) : rien de l'utilisateur précédent ne doit être resservi.
  clearApiCache();
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
  (response) => {
    // Écriture réussie : les données lues avant peuvent avoir changé.
    if ((response.config.method ?? 'get').toLowerCase() !== 'get') {
      clearApiCache();
    }
    return response;
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const hadToken = Boolean(getStoredToken());
      setStoredToken(null);
      onUnauthorized?.(hadToken ? 'expired' : 'invalid');
    }

    if (error.response?.status === 403 && !error.config?.silentForbidden) {
      onForbidden?.();
    }

    return Promise.reject(error);
  }
);
