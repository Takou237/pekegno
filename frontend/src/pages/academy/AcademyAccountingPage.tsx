import { useOutletContext } from 'react-router-dom';
import AccountingPage from '@/pages/accounting/AccountingPage';

interface DepartmentLayoutContext {
  agencyId?: string;
  departmentId?: string;
}

/** Comptabilité d'un département (Academy, Agency…) : uniquement ses écritures. */
export default function AcademyAccountingPage() {
  const { agencyId, departmentId } = useOutletContext<DepartmentLayoutContext>();
  return <AccountingPage fixedAgencyId={agencyId} fixedDepartmentId={departmentId} />;
}
