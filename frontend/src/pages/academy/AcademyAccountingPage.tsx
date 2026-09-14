import { useOutletContext } from 'react-router-dom';
import AccountingPage from '@/pages/accounting/AccountingPage';

interface DepartmentLayoutContext {
  agencyId?: string;
}

export default function AcademyAccountingPage() {
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  return <AccountingPage fixedAgencyId={agencyId} />;
}
