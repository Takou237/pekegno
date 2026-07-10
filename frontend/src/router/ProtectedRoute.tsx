import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInactivityLogout } from '@/hooks/useInactivityLogout';

/**
 * Protège les routes nécessitant une session active.
 * - Attend la fin de la vérification de session (isInitializing) avant de
 *   décider, pour éviter un flash de redirection vers /login au reload.
 * - Branche la déconnexion automatique pour inactivité (jour 2 du plan).
 */
export function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  useInactivityLogout();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"
          aria-label="Chargement"
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
