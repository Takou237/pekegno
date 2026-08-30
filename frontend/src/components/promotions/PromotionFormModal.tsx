import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { promotionsApi } from '@/api/promotions.api';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import type { Service } from '@/types/service';
import type { Promotion, PromotionPayload, PromotionType } from '@/types/promotion';

interface PromotionFormModalProps {
  isOpen: boolean;
  service?: Service | null;
  editing?: Promotion | null;
  agencyId?: string;
  onClose: () => void;
  onSaved: (promotion: Promotion) => void;
}

interface FormState extends PromotionPayload {
  service_id: string;
}

const emptyForm: FormState = {
  service_id: '',
  type: 'amount',
  promo_price: '',
  discount_percent: '',
  start_date: '',
  end_date: '',
};

function toDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PromotionFormModal({
  isOpen,
  service,
  editing,
  agencyId,
  onClose,
  onSaved,
}: PromotionFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFormErrors({});
    setIsSubmitting(false);
    setForm(
      editing
        ? {
            service_id: editing.service_id,
            type: editing.type,
            promo_price: editing.promo_price ?? '',
            discount_percent: editing.discount_percent ?? '',
            start_date: toDateInput(editing.start_date),
            end_date: toDateInput(editing.end_date),
          }
        : {
            ...emptyForm,
            service_id: service?.id ?? '',
          }
    );
  }, [isOpen, editing, service]);

  useEffect(() => {
    if (!isOpen || service || editing || !agencyId) return;
    let cancelled = false;
    setIsLoadingServices(true);
    servicesApi
      .list({ agency_id: agencyId, per_page: 100 })
      .then((r) => {
        if (!cancelled) setServices(r.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoadingServices(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, service, editing, agencyId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);
    try {
      const payload: PromotionPayload = {
        type: form.type,
        promo_price: form.type === 'amount' ? form.promo_price : null,
        discount_percent: form.type === 'percent' ? form.discount_percent : null,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      let saved: Promotion;
      if (editing) {
        saved = await promotionsApi.update(editing.id, payload);
        showToast(t('promotions.updated'), 'success');
      } else {
        saved = await promotionsApi.create(form.service_id, payload);
        showToast(t('promotions.created'), 'success');
      }
      onSaved(saved);
      onClose();
    } catch (error) {
      const fieldErrors = extractFieldErrors(error) as Record<string, string>;
      setFormErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        showToast(extractErrorMessage(error, t('promotions.saveFailed')), 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedServiceName = service?.name ?? editing?.service?.name;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editing ? t('promotions.editTitle') : t('promotions.createTitle')}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {Object.keys(formErrors).length > 0 && (
          <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
        )}

        {selectedServiceName ? (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('promotions.service')}
            </label>
            <input
              type="text"
              value={selectedServiceName}
              disabled
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
            />
          </div>
        ) : (
          <Select
            label={t('promotions.service')}
            required
            disabled={isLoadingServices}
            value={form.service_id}
            onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
            error={formErrors.service_id}
          >
            <option value="">{t('promotions.selectService')}</option>
            {services.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </Select>
        )}

        <Select
          label={t('promotions.type')}
          required
          value={form.type}
          onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as PromotionType }))}
          error={formErrors.type}
        >
          <option value="amount">{t('promotions.typeAmount')}</option>
          <option value="percent">{t('promotions.typePercent')}</option>
        </Select>

        {form.type === 'amount' ? (
          <Input
            label={t('promotions.price')}
            required
            type="number"
            step="0.01"
            min="0"
            value={form.promo_price ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, promo_price: e.target.value }))}
            error={formErrors.promo_price}
            placeholder="0.00"
          />
        ) : (
          <Input
            label={t('promotions.discountPercent')}
            required
            type="number"
            step="0.01"
            min="0.01"
            max="100"
            value={form.discount_percent ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, discount_percent: e.target.value }))}
            error={formErrors.discount_percent}
            placeholder="20"
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('promotions.start')}
            required
            type="date"
            value={form.start_date}
            onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
            error={formErrors.start_date}
          />
          <Input
            label={t('promotions.end')}
            required
            type="date"
            value={form.end_date}
            onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
            error={formErrors.end_date}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {editing ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}