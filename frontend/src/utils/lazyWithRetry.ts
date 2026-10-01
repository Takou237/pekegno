import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

const RELOAD_KEY = 'pekegno:chunk-reload-at';
const RETRY_DELAYS_MS = [500, 1500, 3000];
// Au-delà, on considère que l'utilisateur attend : l'écran d'erreur prend le relais.
const OFFLINE_WAIT_MS = 30_000;

/**
 * Erreur levée quand un fichier JS / CSS d'une page n'a pas pu être téléchargé :
 * connexion coupée, ou build redéployé (l'ancien fichier haché n'existe plus).
 * Les messages diffèrent selon le navigateur.
 */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? '');
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError|Loading chunk .* failed/i.test(
    message,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Attend le retour du réseau (ou un délai maximal) quand le navigateur est hors ligne. */
function waitForOnline(): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('online', done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, OFFLINE_WAIT_MS);
    window.addEventListener('online', done);
  });
}

/**
 * Recharge la page une seule fois par minute : si le fichier n'existe plus
 * (nouveau déploiement), le nouvel index.html pointe vers les bons fichiers.
 * Retourne false si un rechargement vient déjà d'avoir lieu (évite une boucle).
 */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/**
 * `React.lazy` tolérant aux coupures réseau : le chargement d'une page est
 * retenté quelques fois (en attendant le retour de la connexion si besoin)
 * avant d'abandonner. Si le fichier reste introuvable alors que le réseau est
 * là, c'est un ancien build : la page est rechargée une fois. Sinon l'erreur
 * remonte jusqu'à l'écran d'erreur des routes (RouteErrorPage).
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;
        if (!isChunkLoadError(error) || attempt === RETRY_DELAYS_MS.length) break;
        await waitForOnline();
        await wait(RETRY_DELAYS_MS[attempt]);
      }
    }

    if (isChunkLoadError(lastError) && navigator.onLine && reloadOnce()) {
      // La page se recharge : on ne rend rien d'ici là.
      return new Promise<never>(() => {});
    }
    throw lastError;
  });
}
