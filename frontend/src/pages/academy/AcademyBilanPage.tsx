import { useOutletContext } from 'react-router-dom';
import DailyBilanPage from '@/pages/bilans/DailyBilanPage';

interface DepartmentLayoutContext {
  agencyId?: string;
}

export default function AcademyBilanPage() {
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  return <DailyBilanPage fixedAgencyId={agencyId} />;
}
