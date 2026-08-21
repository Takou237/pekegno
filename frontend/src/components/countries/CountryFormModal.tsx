import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { countriesApi, type CountryPayload } from '@/api/countries.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { CountryStat } from '@/types/stats';

const emptyForm: CountryPayload = {
  name: '',
  code: '',
  iso_code: '',
  phone_code: '',
  currency_code: 'XAF',
  is_active: true,
};

interface CountryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (country: CountryStat) => void;
}

export function CountryFormModal({ isOpen, onClose, onSaved }: CountryFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [form, setForm] = useState<CountryPayload>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(emptyForm);
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  function update<K extends keyof CountryPayload>(field: K, value: CountryPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const saved = await countriesApi.create({
        name: form.name,
        code: form.code,
        iso_code: form.iso_code || undefined,
        phone_code: form.phone_code || undefined,
        currency_code: form.currency_code,
        is_active: form.is_active,
      });
      showToast(t('countries.saved'), 'success');
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('countries.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('countries.createTitle')} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('countries.name')}
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder={t('countries.namePlaceholder')}
          />
          <Input
            label={t('countries.code')}
            required
            value={form.code}
            onChange={(e) => update('code', e.target.value)}
            error={fieldErrors.code}
            placeholder={t('countries.codePlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input
            label={t('countries.isoCode')}
            value={form.iso_code ?? ''}
            onChange={(e) => update('iso_code', e.target.value)}
            error={fieldErrors.iso_code}
            placeholder="CM"
            maxLength={3}
          />
          <Input
            label={t('countries.phoneCode')}
            value={form.phone_code ?? ''}
            onChange={(e) => update('phone_code', e.target.value)}
            error={fieldErrors.phone_code}
            placeholder="+237"
          />
          <Input
            label={t('countries.currencyCode')}
            required
            value={form.currency_code}
            onChange={(e) => update('currency_code', e.target.value)}
            error={fieldErrors.currency_code}
            placeholder="XAF"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={form.is_active ?? true}
            onChange={(e) => update('is_active', e.target.checked)}
          />
          {t('countries.isActive')}
        </label>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
