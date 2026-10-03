import InvoiceListPage from '@/pages/invoices/InvoiceListPage';
import { useAgencyDept } from '@/hooks/useAgencyDept';

/** Factures Agency (§6.9) : factures des contrats (packages / prestations) du département. */
export default function AgencyDeptInvoicesPage() {
  const { agencyId, departmentId } = useAgencyDept();
  return <InvoiceListPage fixedAgencyId={agencyId} contractDepartmentId={departmentId} />;
}
