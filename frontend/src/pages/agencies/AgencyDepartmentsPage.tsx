import { useParams } from 'react-router-dom';
import DepartmentListPage from '@/pages/departments/DepartmentListPage';

export default function AgencyDepartmentsPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <DepartmentListPage agencyId={agencyId} />;
}
