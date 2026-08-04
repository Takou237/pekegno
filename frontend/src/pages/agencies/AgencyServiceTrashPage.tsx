import { useParams } from 'react-router-dom';
import ServiceTrashPage from '@/pages/services/ServiceTrashPage';

export default function AgencyServiceTrashPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <ServiceTrashPage agencyId={agencyId} />;
}
