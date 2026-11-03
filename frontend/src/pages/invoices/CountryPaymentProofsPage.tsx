import { useParams } from 'react-router-dom';
import ValidationsPage from '@/pages/invoices/ValidationsPage';

/** Paiements à valider du pays : reste dans /countries/:countryId. */
export default function CountryPaymentProofsPage() {
  const { countryId } = useParams<{ countryId?: string }>();
  return <ValidationsPage fixedCountryId={countryId} />;
}
