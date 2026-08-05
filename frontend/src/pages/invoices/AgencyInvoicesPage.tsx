import { useOutletContext } from 'react-router-dom';
import InvoiceListPage from '@/pages/invoices/InvoiceListPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyInvoicesPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <InvoiceListPage fixedAgencyId={agencyId} />;
}
