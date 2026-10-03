import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAgencyDept } from '@/hooks/useAgencyDept';

/** Onglets de la page Prestations : liste et grand tableau de suivi. */
export function PrestationTabs() {
  const { t } = useTranslation();
  const { basePath } = useAgencyDept();
  const cls = ({ isActive }: { isActive: boolean }) =>
    `whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${isActive ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`;

  return (
    <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
      <NavLink to={`${basePath}/prestations`} end className={cls}>{t('agencyDept.prestations.listTab')}</NavLink>
      <NavLink to={`${basePath}/prestations/tracking`} className={cls}>{t('nav.prestationTracking')}</NavLink>
    </div>
  );
}
