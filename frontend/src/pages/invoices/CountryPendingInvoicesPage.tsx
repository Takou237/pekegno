import { useParams } from 'react-router-dom';
import PendingInvoicesPage from '@/pages/invoices/PendingInvoicesPage';

/** Validations du pays : reste dans /countries/:countryId. */
export default function CountryPendingInvoicesPage() {
  const { countryId } = useParams<{ countryId?: string }>();
  return <PendingInvoicesPage fixedCountryId={countryId} />;
}
