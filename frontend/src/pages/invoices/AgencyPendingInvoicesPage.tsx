import { useOutletContext } from 'react-router-dom';
import PendingInvoicesPage from '@/pages/invoices/PendingInvoicesPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyPendingInvoicesPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <PendingInvoicesPage fixedAgencyId={agencyId} />;
}
