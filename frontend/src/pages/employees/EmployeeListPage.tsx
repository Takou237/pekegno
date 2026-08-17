import { useTranslation } from 'react-i18next';
import CommercialListPage from '@/pages/commercials/CommercialListPage';
import { employeesApi } from '@/api/employees.api';

export default function EmployeeListPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const detailBasePath = fixedAgencyId ? `/agencies/${fixedAgencyId}/employees` : '/employees';
  return (
    <CommercialListPage
      fixedAgencyId={fixedAgencyId}
      overrideApi={employeesApi}
      pageTitle={t('employees.title')}
      pageSubtitle={t('employees.subtitle')}
      detailBasePath={detailBasePath}
    />
  );
}
