import { useOutletContext } from 'react-router-dom';
import EmployeeDetailPage from '@/pages/employees/EmployeeDetailPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyEmployeeDetailPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <EmployeeDetailPage fixedAgencyId={agencyId} />;
}
