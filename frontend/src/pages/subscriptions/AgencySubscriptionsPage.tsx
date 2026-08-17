import { useParams } from 'react-router-dom';
import SubscriptionListPage from './SubscriptionListPage';

export default function AgencySubscriptionsPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <SubscriptionListPage fixedAgencyId={agencyId} />;
}
