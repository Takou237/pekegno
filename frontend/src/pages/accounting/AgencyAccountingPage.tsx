import { useOutletContext } from 'react-router-dom';
import AccountingPage from '@/pages/accounting/AccountingPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyAccountingPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <AccountingPage fixedAgencyId={agencyId} />;
}
