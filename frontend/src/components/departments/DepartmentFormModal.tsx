import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { departmentsApi } from '@/api/departments.api';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Agency } from '@/types/agency';
import type { Department, DepartmentPayload } from '@/types/department';

interface DepartmentFormModalProps {
  isOpen: boolean;
  department: Department | null; // null = création
  onClose: () => void;
  onSaved: () => void;
}

export function DepartmentFormModal({ isOpen, department, onClose, onSaved }: DepartmentFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = department !== null;

  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [form, setForm] = useState<DepartmentPayload>({
    agency_id: '',
    type: 'agency',
    name: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
      setForm({
        agency_id: department?.agency_id ?? '',
        type: department?.type ?? 'agency',
        name: department?.name ?? '',
        description: department?.description ?? '',
      });
      setErrors({});
    }
  }, [isOpen, department]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setIsSubmitting(true);
    try {
      if (isEditing) {
        await departmentsApi.update(department.id, form);
        showToast(t('departments.updated'), 'success');
      } else {
        await departmentsApi.create(form);
        showToast(t('departments.created'), 'success');
      }
      onSaved();
      onClose();
    } catch (error) {
      const fieldErrors = extractFieldErrors(error) as Record<string, string>;
      setErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        showToast(extractErrorMessage(error, t('departments.saveFailed')), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('departments.editTitle') : t('departments.createTitle')}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {Object.keys(errors).length > 0 && (
          <Alert variant="error">{Object.values(errors).join(' ')}</Alert>
        )}

        <Select
          label={t('departments.agency')}
          required
          value={form.agency_id}
          onChange={(e) => setForm((p) => ({ ...p, agency_id: e.target.value }))}
          error={errors.agency_id}
        >
          <option value="">{t('departments.selectAgency')}</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </Select>

        <Select
          label={t('departments.type')}
          required
          value={form.type}
          onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as DepartmentPayload['type'] }))}
          error={errors.type}
        >
          <option value="academy">{t('departmentTypes.academy')}</option>
          <option value="agency">{t('departmentTypes.agency')}</option>
          <option value="store">{t('departmentTypes.store')}</option>
          <option value="studio">{t('departmentTypes.studio')}</option>
        </Select>

        <Input
          label={t('departments.colName')}
          required
          value={form.name}
          onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          error={errors.name}
        />

        <Input
          label={t('departments.description')}
          value={form.description ?? ''}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
          error={errors.description}
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {isEditing ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
