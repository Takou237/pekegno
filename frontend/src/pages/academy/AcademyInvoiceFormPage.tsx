import { useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import InvoiceFormPage from '@/pages/invoices/InvoiceFormPage';
import FormationEnrollmentModal from '@/components/academy/FormationEnrollmentModal';
import { Button } from '@/components/ui/Button';
import type { FormationEnrollment } from '@/types/formation';

interface DepartmentLayoutContext {
  agencyId?: string;
}

export default function AcademyInvoiceFormPage() {
  const { t } = useTranslation();
  const { departmentId } = useParams<{ departmentId?: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const invoicesPath = departmentId ? `/departments/${departmentId}/invoices` : '/invoices';
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);

  function handleEnrollmentSaved(_enrollment: FormationEnrollment) {
    setEnrollmentOpen(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" onClick={() => setEnrollmentOpen(true)}>
          <GraduationCap className="h-4 w-4" />
          {t('academy.newEnrollment')}
        </Button>
      </div>
      <InvoiceFormPage lockedAgencyId={agencyId} backPath={invoicesPath} successPath={invoicesPath} />
      <FormationEnrollmentModal
        isOpen={enrollmentOpen}
        onClose={() => setEnrollmentOpen(false)}
        agencyId={agencyId}
        onSaved={handleEnrollmentSaved}
      />
    </div>
  );
}
