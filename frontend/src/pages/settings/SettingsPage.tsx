import { useEffect, useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '@/api/settings.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import type { CommissionType } from '@/types/settings';

interface SettingsForm {
  sales_points_per_sale: string;
  inactivity_period_days: string;
  inactivity_penalty_points: string;
  default_commission_type: CommissionType;
  default_commission_value: string;
  invoice_prefix: string;
}

const EMPTY_FORM: SettingsForm = {
  sales_points_per_sale: '',
  inactivity_period_days: '',
  inactivity_penalty_points: '',
  default_commission_type: 'none',
  default_commission_value: '',
  invoice_prefix: '',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .list()
      .then((settings) => {
        const map = new Map(settings.map((s) => [s.key, s.value]));
        setForm({
          sales_points_per_sale: String(map.get('sales_points_per_sale') ?? 3),
          inactivity_period_days: String(map.get('inactivity_period_days') ?? 14),
          inactivity_penalty_points: String(map.get('inactivity_penalty_points') ?? 5),
          default_commission_type: (map.get('default_commission_type') as CommissionType) ?? 'none',
          default_commission_value: String(map.get('default_commission_value') ?? 0),
          invoice_prefix: String(map.get('invoice_prefix') ?? 'PK'),
        });
      })
      .catch((error) => {
        setLoadError(extractErrorMessage(error, t('settingsPage.loadFailed')));
      })
      .finally(() => setIsLoading(false));
  }, [t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setFormErrors({});
    try {
      await settingsApi.update({
        sales_points_per_sale: Number(form.sales_points_per_sale),
        inactivity_period_days: Number(form.inactivity_period_days),
        inactivity_penalty_points: Number(form.inactivity_penalty_points),
        default_commission_type: form.default_commission_type,
        default_commission_value: Number(form.default_commission_value),
        invoice_prefix: form.invoice_prefix.trim() || 'PK',
      });
      showToast(t('settingsPage.saved'), 'success');
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('settingsPage.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <SkeletonDetail />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settingsPage.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('settingsPage.subtitle')}</p>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {Object.keys(formErrors).length > 0 && (
        <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('settingsPage.sales')}
          </h2>
          <Input
            label={t('settingsPage.salesPointsPerSale')}
            hint={t('settingsPage.salesPointsPerSaleHint')}
            type="number"
            min="0"
            max="1000"
            required
            value={form.sales_points_per_sale}
            onChange={(e) => setForm((p) => ({ ...p, sales_points_per_sale: e.target.value }))}
          />
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('settingsPage.inactivity')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('settingsPage.inactivityPeriodDays')}
              hint={t('settingsPage.inactivityPeriodDaysHint')}
              type="number"
              min="1"
              max="365"
              required
              value={form.inactivity_period_days}
              onChange={(e) => setForm((p) => ({ ...p, inactivity_period_days: e.target.value }))}
            />
            <Input
              label={t('settingsPage.inactivityPenaltyPoints')}
              hint={t('settingsPage.inactivityPenaltyPointsHint')}
              type="number"
              min="0"
              max="1000"
              required
              value={form.inactivity_penalty_points}
              onChange={(e) => setForm((p) => ({ ...p, inactivity_penalty_points: e.target.value }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('settingsPage.commission')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('settingsPage.defaultCommissionType')}
              value={form.default_commission_type}
              onChange={(e) => setForm((p) => ({ ...p, default_commission_type: e.target.value as CommissionType }))}
            >
              <option value="none">{t('settingsPage.commissionNone')}</option>
              <option value="percent">{t('settingsPage.commissionPercent')}</option>
              <option value="fixed">{t('settingsPage.commissionFixed')}</option>
            </Select>
            <Input
              label={t('settingsPage.defaultCommissionValue')}
              type="number"
              min="0"
              step="0.01"
              required
              value={form.default_commission_value}
              onChange={(e) => setForm((p) => ({ ...p, default_commission_value: e.target.value }))}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('settingsPage.invoicePrefix')}
          </h2>
          <Input
            label={t('settingsPage.invoicePrefix')}
            hint={t('settingsPage.invoicePrefixHint')}
            maxLength={5}
            required
            value={form.invoice_prefix}
            onChange={(e) => setForm((p) => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}>
            <Save className="h-4 w-4" />
            {t('settingsPage.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
