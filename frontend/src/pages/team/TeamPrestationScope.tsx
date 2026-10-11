import { useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Alert } from '@/components/ui/Alert';
import type { DepartmentOutletContext } from '@/hooks/useAgencyDept';

/**
 * Socle des pages dédiées de l'équipier : charge la prestation (accès déjà
 * contrôlé côté backend) et fournit le contexte département aux pages détail
 * partagées, sans passer par les URLs du département.
 */
export default function TeamPrestationScope() {
  const { t } = useTranslation();
  const { prestationId } = useParams<{ prestationId?: string }>();
  const [context, setContext] = useState<DepartmentOutletContext | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!prestationId) return;
    setContext(null);
    setFailed(false);
    agencyDeptApi
      .prestation(prestationId)
      .then((p) =>
        setContext({
          department: null,
          departmentId: p.department_id ?? undefined,
          agencyId: p.agency_id,
          teamMode: true,
        }),
      )
      .catch(() => setFailed(true));
  }, [prestationId]);

  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/team/tracking" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400">
          <ArrowLeft className="h-4 w-4" /> {t('agencyDept.team.myMissions')}
        </Link>
        <Alert variant="error">{t('common.error')}</Alert>
      </div>
    );
  }

  if (!context?.departmentId) return <SkeletonDetail />;

  return <Outlet context={context} />;
}
