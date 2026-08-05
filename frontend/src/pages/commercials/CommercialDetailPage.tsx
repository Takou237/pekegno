import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Pencil, FileText, BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commercialsApi } from '@/api/commercials.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import {
  CommercialForm,
  commercialFormFrom,
} from '@/components/commercials/CommercialForm';
import type { Commercial, CommercialStats } from '@/types/commercial';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(currentLocale()).format(n)} FCFA`;
}

export default function CommercialDetailPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const backTo = fixedAgencyId ? `/agencies/${fixedAgencyId}/commercials` : '/commercials';

  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(commercialFormFrom(null));
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );
  const canAdjustPoints = ['super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  async function fetchAll() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([commercialsApi.get(id), commercialsApi.stats(id)]);
      setCommercial(c);
      setStats(s);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('commercials.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function openEdit() {
    setEditForm(commercialFormFrom(commercial));
    setEditErrors({});
    setEditOpen(true);
  }

  async function handleEditSubmit(event: FormEvent) {
    event.preventDefault();
    setEditSubmitting(true);
    setEditErrors({});
    try {
      const payload = {
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email || null,
        phone: editForm.phone || null,
        user_id: editForm.user_id || null,
        agency_id: editForm.agency_id || null,
        commission_type: editForm.commission_type,
        commission_value: editForm.commission_type === 'none' ? null : editForm.commission_value || 0,
        is_active: editForm.is_active,
      };
      await commercialsApi.update(id, payload);
      showToast(t('commercials.updated'), 'success');
      setEditOpen(false);
      fetchAll();
    } catch (error) {
      setEditErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('commercials.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleAdjust(event: FormEvent) {
    event.preventDefault();
    const value = Number(adjustPoints);
    if (!Number.isFinite(value) || value === 0) {
      setAdjustError(t('commercials.adjustFailed'));
      return;
    }
    setAdjustSubmitting(true);
    setAdjustError(null);
    try {
      await commercialsApi.adjustPoints(id, value);
      showToast(t('commercials.adjusted'), 'success');
      setAdjustOpen(false);
      fetchAll();
    } catch (error) {
      setAdjustError(extractErrorMessage(error, t('commercials.adjustFailed')));
    } finally {
      setAdjustSubmitting(false);
    }
  }

  function pointReasonLabel(reason: string): string {
    switch (reason) {
      case 'sale':
        return t('commercials.pointsReasonSale');
      case 'penalty':
        return t('commercials.pointsReasonPenalty');
      case 'adjustment':
        return t('commercials.pointsReasonAdjustment');
      default:
        return reason;
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (loadError || !commercial) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('commercials.title')}
        </Link>
        <p className="text-sm text-error-500">{loadError ?? t('commercials.loadFailed')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={backTo}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('commercials.title')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {[commercial.first_name, commercial.last_name].filter(Boolean).join(' ')}
              </h1>
              {commercial.is_active ? (
                <Badge variant="success">{t('common.active')}</Badge>
              ) : (
                <Badge variant="error">{t('common.inactive')}</Badge>
              )}
              {commercial.user && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {t('commercials.linkedUser')}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {[commercial.email, commercial.phone, commercial.agency?.name]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {canManage && (
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                navigate(
                  fixedAgencyId
                    ? `/agencies/${fixedAgencyId}/invoices?commercial_id=${id}`
                    : `/invoices?commercial_id=${id}`
                )
              }
            >
              <FileText className="h-4 w-4" />
              {t('commercials.viewInvoices')}
            </Button>
            {canAdjustPoints && (
              <Button onClick={() => setAdjustOpen(true)}>
                <Star className="h-4 w-4" />
                {t('commercials.adjustPoints')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercials.statsTurnover')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats?.turnover ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercials.statsSales')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {stats?.sales_count ?? 0}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercials.statsCommissions')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
            {formatCurrency(stats?.commissions ?? 0)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('commercials.pointsHistory')}
          </h2>
        </div>
        {!commercial.points || commercial.points.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.noPointsHistory')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('commercials.pointsValue')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercials.reason')}</th>
                  <th className="px-5 py-3 font-medium">{t('audit.colDate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {commercial.points.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <span
                        className={`font-semibold ${
                          p.points >= 0 ? 'text-success-600' : 'text-error-500'
                        }`}
                      >
                        {p.points > 0 ? `+${p.points}` : p.points}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {pointReasonLabel(p.reason)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(p.created_at).toLocaleString(currentLocale())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('commercials.editTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4">
          {Object.keys(editErrors).length > 0 && (
            <Alert variant="error">{Object.values(editErrors).join(' ')}</Alert>
          )}
          <CommercialForm
            value={editForm}
            onChange={setEditForm}
            errors={editErrors}
            linkedUserLabel={
              commercial.user
                ? [commercial.user.first_name, commercial.user.last_name].filter(Boolean).join(' ') ||
                  commercial.user.email
                : ''
            }
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={editSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={t('commercials.adjustTitle', {
          name: [commercial.first_name, commercial.last_name].filter(Boolean).join(' '),
        })}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAdjust} className="flex flex-col gap-4">
          <Alert variant="info">{t('commercials.adjustHint')}</Alert>
          {adjustError && <Alert variant="error">{adjustError}</Alert>}
          <Input
            label={t('commercials.pointsValue')}
            type="number"
            required
            value={adjustPoints}
            onChange={(e) => setAdjustPoints(e.target.value)}
            placeholder="+10 / -5"
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAdjustOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={adjustSubmitting} className="flex-1">
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
