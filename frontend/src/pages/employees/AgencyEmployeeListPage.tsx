import { useOutletContext } from 'react-router-dom';
import EmployeeListPage from '@/pages/employees/EmployeeListPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyEmployeeListPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <EmployeeListPage fixedAgencyId={agencyId} />;
}
