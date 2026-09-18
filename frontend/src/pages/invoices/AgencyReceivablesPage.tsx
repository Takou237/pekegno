import { useOutletContext } from 'react-router-dom';
import ReceivablesPage from '@/pages/invoices/ReceivablesPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyReceivablesPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <ReceivablesPage fixedAgencyId={agencyId} />;
}
