import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';
import { useDisplayCurrencySync } from '@/hooks/useDisplayCurrencySync';

/**
 * Protège les routes nécessitant une session active.
 * - Attend la fin de la vérification de session (isInitializing) avant de
 *   décider, pour éviter un flash de redirection vers /login au reload.
 * - Branche la déconnexion automatique pour inactivité (jour 2 du plan).
 */
export function ProtectedRoute() {
  const { t } = useTranslation();
  const { isAuthenticated, isInitializing, user } = useAuth();
  const location = useLocation();

  useInactivityLogout();
  useDisplayCurrencySync();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
          aria-label={t('common.loading')}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Lot 9 : 2FA obligatoire pour les rôles sensibles, uniquement lorsque
  // l'API l'impose (SECURITY_ENFORCE_2FA). L'utilisateur est alors redirigé
  // vers ses paramètres tant qu'il n'a pas activé la double authentification.
  if (user?.two_factor_setup_required && !location.pathname.startsWith('/profile/settings')) {
    return <Navigate to="/profile/settings" replace />;
  }

  return <Outlet />;
}
