import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { departmentsApi } from '@/api/departments.api';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PEKEGNOGroupDashboard from '@/pages/dashboard/PEKEGNOGroupDashboard';
import { getUserMainItems, isCustomRole } from '@/components/layout/navItems';

/**
 * Redirige la racine / vers la vue adaptée au rôle connecté :
 * - responsable-agence → son agence (point d'entrée = l'agence)
 * - responsable-departement → son département (point d'entrée = le département)
 * - caissier → tableau de bord caisse (Caisse du jour)
 * - commercial → tableau de bord commercial
 * - formateur → tableau de bord formateur
 * - community-manager → suivi de ses prestations et actions
 * - autres → tableau de bord global
 */
export function HomeRedirect() {
  const { t } = useTranslation();
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
    // Affectations anciennes sans department_id : l'API liste déjà les
    // départements du chef → on entre dans le premier.
    return <DepartmentHomeRedirect />;
  }

  // Directeur général rattaché à un pays : son espace est ce pays.
  if (role === 'direction-generale' && user?.country_id) {
    return <Navigate to={`/countries/${user.country_id}`} replace />;
  }

  if (role === 'caissier') {
    return <Navigate to="/caissier/dashboard" replace />;
  }

  if (role === 'commercial') {
    return <Navigate to="/commercial/dashboard" replace />;
  }

  if (role === 'formateur') {
    return <Navigate to="/formateur" replace />;
  }

  if (role === 'community-manager') {
    return <Navigate to="/team/tracking" replace />;
  }

  // Rôle personnalisé sans accès au tableau de bord : on l'envoie sur la
  // première page de son menu (construit depuis ses permissions).
  if (isCustomRole(role) && !user?.permissions?.includes('stats.consulter')) {
    return <Navigate to={getUserMainItems(t, user)[0]?.to ?? '/team/tracking'} replace />;
  }

  return <PEKEGNOGroupDashboard />;
}

/** Repli chef de département : entre dans son premier département, sinon la liste. */
function DepartmentHomeRedirect() {
  const [target, setTarget] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    departmentsApi
      .list({ per_page: 1 })
      .then((res) => {
        if (active) setTarget(res.data[0]?.id);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (failed) return <Navigate to="/departments" replace />;
  if (target === undefined) return <PageSkeleton />;
  if (target) return <Navigate to={`/departments/${target}`} replace />;
  return <Navigate to="/departments" replace />;
}
