import PendingInvoicesPage from '@/pages/invoices/PendingInvoicesPage';
import { useAgencyDept } from '@/hooks/useAgencyDept';

/** Validations du département : reste dans /departments/:departmentId. */
export default function DepartmentPendingInvoicesPage() {
  const { departmentId, agencyId } = useAgencyDept();
  return <PendingInvoicesPage departmentId={departmentId} fixedAgencyId={agencyId} />;
}
