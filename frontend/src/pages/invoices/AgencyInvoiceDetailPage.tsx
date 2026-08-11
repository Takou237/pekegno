import { useOutletContext } from 'react-router-dom';
import InvoiceDetailPage from '@/pages/invoices/InvoiceDetailPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyInvoiceDetailPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <InvoiceDetailPage fixedAgencyId={agencyId} />;
}
