import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { promotionsApi } from '@/api/promotions.api';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { currentLocale } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Agency } from '@/types/agency';
import type { Service } from '@/types/service';
import type { Promotion, PromotionPayload } from '@/types/promotion';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

function formatPrice(value: string): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function toDateInput(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function AgencyPromotionsPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { agency, agencyId } = useOutletContext<AgencyLayoutContext>();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);
  const [form, setForm] = useState<PromotionPayload & { service_id: string }>({
    service_id: '',
    promo_price: '',
    start_date: '',
    end_date: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchPromotions = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await promotionsApi.list({ agency_id: agencyId, per_page: 100 });
      setPromotions(response.data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('promotions.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    fetchPromotions();
  }, [fetchPromotions]);

  useEffect(() => {
    if (!agencyId) return;
    servicesApi.list({ agency_id: agencyId, per_page: 100 }).then((r) => setServices(r.data)).catch(() => {});
  }, [agencyId]);

  function openCreate() {
    setEditing(null);
    setForm({ service_id: '', promo_price: '', start_date: '', end_date: '' });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(promotion: Promotion) {
    setEditing(promotion);
    setForm({
      service_id: promotion.service_id,
      promo_price: promotion.promo_price,
      start_date: toDateInput(promotion.start_date),
      end_date: toDateInput(promotion.end_date),
    });
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormErrors({});
    setIsSubmitting(true);
    try {
      const payload: PromotionPayload = {
        promo_price: form.promo_price,
        start_date: form.start_date,
        end_date: form.end_date,
      };
      if (editing) {
        await promotionsApi.update(editing.id, payload);
        showToast(t('promotions.updated'), 'success');
      } else {
        await promotionsApi.create(form.service_id, payload);
        showToast(t('promotions.created'), 'success');
      }
      setFormOpen(false);
      fetchPromotions();
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

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await promotionsApi.remove(deleteTarget.id);
      showToast(t('promotions.deleted'), 'success');
      setDeleteTarget(null);
      fetchPromotions();
    } catch (error) {
      showToast(extractErrorMessage(error, t('promotions.deleteFailed')), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  function statusOf(promotion: Promotion): 'active' | 'upcoming' | 'expired' {
    if (promotion.is_active) return 'active';
    return new Date(promotion.end_date) > new Date() ? 'upcoming' : 'expired';
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('promotions.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('promotions.subtitle')}</p>
        </div>
        {canManage && agencyId && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('promotions.create')}
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : promotions.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('promotions.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('promotions.service')}</th>
                  <th className="px-5 py-3 font-medium">{t('promotions.price')}</th>
                  <th className="px-5 py-3 font-medium">{t('promotions.start')}</th>
                  <th className="px-5 py-3 font-medium">{t('promotions.end')}</th>
                  <th className="px-5 py-3 font-medium">{t('promotions.status')}</th>
                  {canManage && <th className="px-5 py-3 text-right">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {promotions.map((promotion) => {
                  const status = statusOf(promotion);
                  return (
                    <tr key={promotion.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 font-medium text-gray-800 dark:text-gray-100">
                          <Tag className="h-4 w-4 text-gray-400" />
                          {promotion.service?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-800 dark:text-gray-100">
                        {formatPrice(promotion.promo_price)}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(promotion.start_date).toLocaleDateString(currentLocale())}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(promotion.end_date).toLocaleDateString(currentLocale())}
                      </td>
                      <td className="px-5 py-3">
                        {status === 'active' && <Badge variant="success">{t('promotions.active')}</Badge>}
                        {status === 'upcoming' && <Badge variant="brand">{t('promotions.upcoming')}</Badge>}
                        {status === 'expired' && <Badge variant="neutral">{t('promotions.expired')}</Badge>}
                      </td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEdit(promotion)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(promotion)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('promotions.editTitle') : t('promotions.createTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}

          {!editing && (
            <Select
              label={t('promotions.service')}
              required
              value={form.service_id}
              onChange={(e) => setForm((p) => ({ ...p, service_id: e.target.value }))}
              error={formErrors.service_id}
            >
              <option value="">{t('promotions.selectService')}</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          )}

          {editing && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('promotions.service')}
              </label>
              <input
                type="text"
                value={editing.service?.name ?? '—'}
                disabled
                className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              />
            </div>
          )}

          <Input
            label={t('promotions.price')}
            required
            type="number"
            step="0.01"
            min="0"
            value={form.promo_price}
            onChange={(e) => setForm((p) => ({ ...p, promo_price: e.target.value }))}
            error={formErrors.promo_price}
            placeholder="0.00"
          />

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
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={t('promotions.deleteTitle')}
        message={t('promotions.deleteMessage', { service: deleteTarget?.service?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        isLoading={isDeleting}
      />

      {!agency && <span className="hidden" />}
    </div>
  );
}
