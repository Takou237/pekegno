import { useOutletContext } from 'react-router-dom';
import ProspectsList from '@/components/prospects/ProspectsList';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

export default function AcademyProspectsPage() {
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  return <ProspectsList agencyId={agencyId} />;
}
