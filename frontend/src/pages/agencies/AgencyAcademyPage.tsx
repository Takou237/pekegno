import { useOutletContext, useParams } from 'react-router-dom';
import AcademyDashboardPage from '@/pages/dashboard/AcademyDashboardPage';

interface LayoutContext {
  agencyId?: string;
}

export default function AgencyAcademyPage() {
  const params = useParams<{ agencyId?: string }>();
  const { agencyId: contextAgencyId } = useOutletContext<LayoutContext>();
  const agencyId = params.agencyId ?? contextAgencyId ?? '';
  return <AcademyDashboardPage fixedAgencyId={agencyId} />;
}
