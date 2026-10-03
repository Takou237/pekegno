import { useOutletContext } from 'react-router-dom';
import DailyBilanPage from '@/pages/bilans/DailyBilanPage';

interface DepartmentLayoutContext {
  agencyId?: string;
  departmentId?: string;
}

/** Bilan du jour d'un département (Academy, Agency…) : uniquement ses ventes et dépenses. */
export default function AcademyBilanPage() {
  const { agencyId, departmentId } = useOutletContext<DepartmentLayoutContext>();
  return <DailyBilanPage fixedAgencyId={agencyId} fixedDepartmentId={departmentId} />;
}
