import { useTranslation } from 'react-i18next';
import CommercialDetailPage from '@/pages/commercials/CommercialDetailPage';
import { employeesApi } from '@/api/employees.api';

export default function EmployeeDetailPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const backToListPath = fixedAgencyId ? `/agencies/${fixedAgencyId}/employees` : '/employees';
  return (
    <CommercialDetailPage
      fixedAgencyId={fixedAgencyId}
      overrideApi={employeesApi}
      pageTitle={t('employees.title')}
      backToListLabel={t('employees.title')}
      backToListPath={backToListPath}
    />
  );
}
