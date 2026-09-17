import { useParams } from 'react-router-dom';
import CommercialListPage from '@/pages/commercials/CommercialListPage';

export default function CountryCommercialsPage() {
  const { countryId } = useParams<{ countryId: string }>();
  return <CommercialListPage reportPath={`/countries/${countryId}/commercials/report`} />;
}
