import { useParams } from 'react-router-dom';
import EmployeeListPage from '@/pages/employees/EmployeeListPage';

export default function CountryEmployeeListPage() {
  const { countryId } = useParams<{ countryId: string }>();
  return <EmployeeListPage reportPath={`/countries/${countryId}/employees/report`} />;
}
