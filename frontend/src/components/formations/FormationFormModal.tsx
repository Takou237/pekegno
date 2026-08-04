import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { formationsApi } from '@/api/formations.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import type { Formation, FormationPayload } from '@/types/formation';
import type { Service, FormationType } from '@/types/service';

interface FormationFormState {
  service_id: string;
  type: FormationType;
  duration: string;
  conditions: string;
  deposit_amount: string;
  installments_count: string;
  online_payment: boolean;
}

function emptyForm(): FormationFormState {
  return {
    service_id: '',
    type: 'presentiel',
    duration: '',
    conditions: '',
    deposit_amount: '',
    installments_count: '',
    online_payment: false,
  };
}

interface FormationFormModalProps {
  isOpen: boolean;
  formation: Formation | null; // null = création
  services: Service[]; // services éligibles (non-formations) pour la création
  onClose: () => void;
  onSaved: () => void;
}

export function FormationFormModal({ isOpen, formation, services, onClose, onSaved }: FormationFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = formation !== null;

  const [form, setForm] = useState<FormationFormState>(emptyForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(
        formation
          ? {
              service_id: formation.service?.id ?? '',
              type: formation.type,
              duration: formation.duration ?? '',
              conditions: formation.conditions ?? '',
              deposit_amount: formation.deposit_amount ?? '',
              installments_count: formation.installments_count?.toString() ?? '',
              online_payment: formation.online_payment,
            }
          : emptyForm()
      );
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, formation]);

  function update<K extends keyof FormationFormState>(field: K, value: FormationFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): FormationPayload {
    return {
      service_id: form.service_id || undefined,
      type: form.type,
      duration: form.duration.trim() || null,
      conditions: form.conditions.trim() || null,
      deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
      installments_count: form.installments_count ? Number(form.installments_count) : null,
      online_payment: form.online_payment,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload();
      if (isEditing) {
        const { service_id: _serviceId, ...rest } = payload;
        await formationsApi.update(formation.id, rest);
      } else {
        await formationsApi.create(payload);
      }

      showToast(isEditing ? t('formations.updated') : t('formations.saved'), 'success');
      onSaved();
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('formations.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('formations.editTitle') : t('formations.createTitle')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        {!isEditing && (
          <Select
            label={t('formations.service')}
            required
            value={form.service_id}
            onChange={(e) => update('service_id', e.target.value)}
            error={fieldErrors.service_id}
          >
            <option value="">{t('formations.selectService')}</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </Select>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label={t('formations.type')}
            value={form.type}
            onChange={(e) => update('type', e.target.value as FormationType)}
          >
            <option value="presentiel">{t('formations.presentiel')}</option>
            <option value="distanciel">{t('formations.distanciel')}</option>
          </Select>
          <Input
            label={t('formations.duration')}
            value={form.duration}
            onChange={(e) => update('duration', e.target.value)}
            error={fieldErrors.duration}
            placeholder={t('formations.durationPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('formations.depositAmount')}
            type="number"
            step="0.01"
            min="0"
            value={form.deposit_amount}
            onChange={(e) => update('deposit_amount', e.target.value)}
            error={fieldErrors.deposit_amount}
            placeholder="0.00"
          />
          <Input
            label={t('formations.installmentsCount')}
            type="number"
            min="1"
            value={form.installments_count}
            onChange={(e) => update('installments_count', e.target.value)}
            error={fieldErrors.installments_count}
            placeholder="1"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('formations.conditions')}
          </label>
          <textarea
            value={form.conditions}
            onChange={(e) => update('conditions', e.target.value)}
            rows={3}
            placeholder={t('formations.conditionsPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <Checkbox
          label={t('formations.onlinePayment')}
          checked={form.online_payment}
          onChange={(e) => update('online_payment', e.target.checked)}
        />

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
