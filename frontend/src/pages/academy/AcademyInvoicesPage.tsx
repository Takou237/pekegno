import { useOutletContext, useParams } from 'react-router-dom';
import InvoiceListPage from '@/pages/invoices/InvoiceListPage';

interface DepartmentLayoutContext {
  agencyId?: string;
}

export default function AcademyInvoicesPage() {
  const { departmentId } = useParams<{ departmentId?: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const newInvoicePath = departmentId ? `/departments/${departmentId}/invoices/new` : undefined;
  return <InvoiceListPage fixedAgencyId={agencyId} enrollmentOnly newInvoicePath={newInvoicePath} />;
}
