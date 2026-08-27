import { useOutletContext } from 'react-router-dom';
import InvoiceListPage from '@/pages/invoices/InvoiceListPage';

interface DepartmentLayoutContext {
  agencyId?: string;
}

export default function AcademyInvoicesPage() {
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  return <InvoiceListPage fixedAgencyId={agencyId} enrollmentOnly />;
}
