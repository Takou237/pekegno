import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Agency, AgencyPayload } from '@/types/agency';

const emptyForm: AgencyPayload = {
  name: '',
  country: '',
  city: '',
  address: '',
  phone: '',
  email: '',
};

interface AgencyFormModalProps {
  isOpen: boolean;
  agency: Agency | null; // null = création
  onClose: () => void;
  onSaved: (agency: Agency) => void;
}

export function AgencyFormModal({ isOpen, agency, onClose, onSaved }: AgencyFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = agency !== null;

  const [form, setForm] = useState<AgencyPayload>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(
        agency
          ? {
              name: agency.name,
              country: agency.country,
              city: agency.city ?? '',
              address: agency.address ?? '',
              phone: agency.phone ?? '',
              email: agency.email ?? '',
            }
          : emptyForm
      );
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, agency]);

  function update<K extends keyof AgencyPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const saved = isEditing
        ? await agenciesApi.update(agency.id, form)
        : await agenciesApi.create(form);

      showToast(
        isEditing ? t('agencies.updated') : t('agencies.saved'),
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('agencies.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('agencies.editTitle') : t('agencies.createTitle')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('agencies.name')}
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder={t('agencies.namePlaceholder')}
          />
          <Input
            label={t('agencies.country')}
            required
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            error={fieldErrors.country}
            placeholder={t('agencies.countryPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('agencies.city')}
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            error={fieldErrors.city}
            placeholder={t('agencies.cityPlaceholder')}
          />
          <Input
            label={t('agencies.address')}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            error={fieldErrors.address}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('auth.phone')}
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            error={fieldErrors.phone}
            placeholder={t('agencies.phonePlaceholder')}
          />
          <Input
            label={t('auth.email')}
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            error={fieldErrors.email}
          />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <div className="w-32">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </div>
          <div className="w-40">
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
