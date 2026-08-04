import { useParams } from 'react-router-dom';
import DepartmentTrashPage from '@/pages/departments/DepartmentTrashPage';

export default function AgencyDepartmentTrashPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  return <DepartmentTrashPage agencyId={agencyId} />;
}
