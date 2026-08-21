import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { agenciesApi } from '@/api/agencies.api';
import { PageSkeleton } from '@/components/ui/Skeleton';

/**
 * Redirige les anciennes URL globales `/agencies/:agencyId/...` vers la
 * forme imbriquée dans le pays `/countries/:countryId/agencies/:agencyId/...`.
 * L'agence appartient toujours à un pays, donc on résout son pays pour
 * préserver le contexte de navigation.
 */
export function AgencyRedirect() {
  const { agencyId, '*': rest } = useParams<{ agencyId: string; '*': string }>();
  const [countryId, setCountryId] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setCountryId(null);
    setFailed(false);
    if (!agencyId) return;

    agenciesApi
      .get(agencyId)
      .then((agency) => {
        if (active) setCountryId(agency.country_id ?? null);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [agencyId]);

  if (failed) {
    return <Navigate to="/agencies" replace />;
  }

  if (!countryId) {
    return <PageSkeleton />;
  }

  const target = `/countries/${countryId}/agencies/${agencyId}${rest ? `/${rest}` : ''}`;
  return <Navigate to={target} replace />;
}
