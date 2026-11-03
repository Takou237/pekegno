import ValidationsPage from '@/pages/invoices/ValidationsPage';
import { useAgencyDept } from '@/hooks/useAgencyDept';

/** Paiements à valider du département : reste dans /departments/:departmentId. */
export default function DepartmentPaymentProofsPage() {
  const { departmentId, agencyId } = useAgencyDept();
  return <ValidationsPage fixedAgencyId={agencyId} fixedDepartmentId={departmentId} />;
}
