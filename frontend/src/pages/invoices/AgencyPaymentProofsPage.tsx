import { useOutletContext } from 'react-router-dom';
import ValidationsPage from '@/pages/invoices/ValidationsPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyPaymentProofsPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <ValidationsPage fixedAgencyId={agencyId} />;
}
