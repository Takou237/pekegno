import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PEKEGNOGroupDashboard from '@/pages/dashboard/PEKEGNOGroupDashboard';

/**
 * Redirige la racine / vers la vue adaptée au rôle connecté :
 * - caissier → file de validation des factures
 * - commercial → tableau de bord commercial
 * - autres → tableau de bord global
 */
export function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role?.name;

  if (role === 'caissier') {
    return <Navigate to="/invoices/pending" replace />;
  }

  if (role === 'commercial') {
    return <Navigate to="/commercial/dashboard" replace />;
  }

  return <PEKEGNOGroupDashboard />;
}
