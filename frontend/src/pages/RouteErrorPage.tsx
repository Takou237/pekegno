import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { isChunkLoadError } from '@/utils/lazyWithRetry';

/**
 * Écran d'erreur des routes, à la place du « Unexpected Application Error! »
 * brut de React Router. Importé statiquement (jamais en lazy) : il doit
 * s'afficher même quand c'est justement le chargement d'une page qui échoue.
 *
 * Coupure réseau : la page se recharge seule au retour de la connexion.
 */
export default function RouteErrorPage() {
  const error = useRouteError();
  const { t } = useTranslation();
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);

  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      // Le module manquant ne peut être retéléchargé qu'au rechargement.
      if (chunkError) window.location.reload();
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [chunkError]);

  if (!chunkError && !offline) {
    console.error(isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error);
  }

  const kind = offline ? 'offline' : chunkError ? 'load' : 'generic';
  const Icon = kind === 'offline' ? WifiOff : kind === 'load' ? RefreshCw : AlertTriangle;

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
        <Icon className="h-8 w-8 text-brand-500" />
      </div>
      <h2 className="mt-6 text-lg font-semibold text-gray-900 dark:text-white">
        {t(`routeError.${kind}Title`)}
      </h2>
      <p className="mt-2 max-w-md text-sm text-gray-500 dark:text-gray-400">
        {t(`routeError.${kind}Desc`)}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button onClick={() => window.location.reload()}>{t('routeError.retry')}</Button>
        <Button variant="outline" onClick={() => window.location.assign('/')}>
          {t('routeError.home')}
        </Button>
      </div>
    </div>
  );
}
