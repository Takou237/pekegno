import { useOutletContext, useParams } from 'react-router-dom';
import InvoiceFormPage from '@/pages/invoices/InvoiceFormPage';

interface DepartmentLayoutContext {
  agencyId?: string;
}

// Création d'une facture depuis un département : l'agence est figée sur
// celle du département et la navigation retour reste dans le contexte
// `/departments/:departmentId/invoices`.
export default function AcademyInvoiceFormPage() {
  const { departmentId } = useParams<{ departmentId?: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const invoicesPath = departmentId ? `/departments/${departmentId}/invoices` : '/invoices';
  return <InvoiceFormPage lockedAgencyId={agencyId} backPath={invoicesPath} successPath={invoicesPath} />;
}