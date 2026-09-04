import { useOutletContext } from 'react-router-dom';
import ServiceListPage from '@/pages/services/ServiceListPage';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

export default function DepartmentServicesPage() {
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  return <ServiceListPage agencyId={agencyId} showAcademyTabs />;
}
