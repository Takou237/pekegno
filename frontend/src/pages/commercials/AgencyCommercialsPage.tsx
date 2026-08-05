import { useOutletContext } from 'react-router-dom';
import CommercialListPage from '@/pages/commercials/CommercialListPage';

interface AgencyLayoutContext {
  agencyId?: string;
}

export default function AgencyCommercialsPage() {
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  return <CommercialListPage fixedAgencyId={agencyId} />;
}
