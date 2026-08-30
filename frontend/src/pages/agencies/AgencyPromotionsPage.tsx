import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { promotionsApi } from '@/api/promotions.api';
import { extractErrorMessage } from '@/api/errors';
import { currentLocale } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import PromotionFormModal from '@/components/promotions/PromotionFormModal';
import type { Agency } from '@/types/agency';
import type { Promotion } from '@/types/promotion';

interface AgencyLayoutContext {
  agency?: Agency | null;
  agencyId?: string;
}

function formatPrice(value: string): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function AgencyPromotionsPage() {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<AgencyLayoutContext>();

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Promotion | null>(null);

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

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(promotion: Promotion) {
    setEditing(promotion);
    setFormOpen(true);
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
          <SkeletonTable />
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
                      <td className="px-5 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {formatPrice(promotion.effective_price ?? '0')}
                          </span>
                          <span className="text-xs text-gray-400">
                            {promotion.type === 'percent'
                              ? `${promotion.discount_percent}%`
                              : formatPrice(promotion.promo_price ?? '0')}
                          </span>
                        </div>
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

      <PromotionFormModal
        isOpen={formOpen}
        editing={editing}
        agencyId={agencyId}
        onClose={() => setFormOpen(false)}
        onSaved={fetchPromotions}
      />

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
    </div>
  );
}