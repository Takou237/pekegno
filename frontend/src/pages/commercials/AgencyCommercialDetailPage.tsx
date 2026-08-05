import { useOutletContext, useParams } from 'react-router-dom';
import CommercialDetailPage from '@/pages/commercials/CommercialDetailPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyCommercialDetailPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  const { commercialId } = useParams();
  return <CommercialDetailPage key={commercialId} fixedAgencyId={agencyId} />;
}
