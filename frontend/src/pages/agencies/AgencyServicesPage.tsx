import { useParams } from 'react-router-dom';
import ServiceListPage from '@/pages/services/ServiceListPage';

export default function AgencyServicesPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <ServiceListPage agencyId={agencyId} showAcademyTabs />;
}
