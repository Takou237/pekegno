import { useOutletContext } from 'react-router-dom';
import CommercialReportPage from '@/pages/commercials/CommercialReportPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyEmployeeReportPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <CommercialReportPage fixedAgencyId={agencyId} mode="employee" />;
}
