import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PEKEGNOGroupDashboard from '@/pages/dashboard/PEKEGNOGroupDashboard';

/**
 * Redirige la racine / vers la vue adaptée au rôle connecté :
 * - responsable-agence → son agence (point d'entrée = l'agence)
 * - responsable-departement → son département (point d'entrée = le département)
 * - caissier → tableau de bord caisse (Caisse du jour)
 * - commercial → tableau de bord commercial
 * - community-manager → suivi de ses prestations et actions
 * - autres → tableau de bord global
 */
export function HomeRedirect() {
  const { user } = useAuth();
  const role = user?.role?.name;

  if (role === 'responsable-agence') {
    // /agencies/:id résout le pays puis redirige vers l'URL imbriquée.
    const chiefOf = user?.assignments?.find((a) => a.pivot?.is_primary === true);
    if (chiefOf) return <Navigate to={`/agencies/${chiefOf.id}`} replace />;
    return <Navigate to="/agencies" replace />;
  }

  if (role === 'responsable-departement') {
    const chiefOf = user?.assignments?.find((a) => a.pivot?.is_department_chief === true);
    const departmentId = chiefOf?.pivot?.department_id;
    if (departmentId) return <Navigate to={`/departments/${departmentId}`} replace />;
    return <Navigate to="/departments" replace />;
  }

  if (role === 'caissier') {
    return <Navigate to="/caissier/dashboard" replace />;
  }

  if (role === 'commercial') {
    return <Navigate to="/commercial/dashboard" replace />;
  }

  if (role === 'community-manager') {
    return <Navigate to="/team/tracking" replace />;
  }

  return <PEKEGNOGroupDashboard />;
}
