import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Pencil, FileText, BadgeCheck, UserPlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commercialsApi } from '@/api/commercials.api';
import { invoicesApi } from '@/api/invoices.api';
import { prospectsApi } from '@/api/prospects.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatRelativeDate } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import type { Invoice } from '@/types/invoice';
import {
  CommercialForm,
  commercialFormFrom,
} from '@/components/commercials/CommercialForm';
import type { Commercial, CommercialStats } from '@/types/commercial';
import type { CommercialApiLike } from '@/pages/commercials/CommercialListPage';
import type { Prospect } from '@/types/prospect';

interface ProspectForm {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  notes: string;
}

const EMPTY_PROSPECT_FORM: ProspectForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  address: '',
  notes: '',
};

export default function CommercialDetailPage({ fixedAgencyId, overrideApi, pageTitle, backToListLabel, backToListPath }: { fixedAgencyId?: string; overrideApi?: CommercialApiLike; pageTitle?: string; backToListLabel?: string; backToListPath?: string }) {
  const { id: routeId, commercialId } = useParams();
  const id = commercialId ?? routeId ?? '';
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const commercialApi = overrideApi ?? commercialsApi;
  const backTo = backToListPath ?? (fixedAgencyId ? `/agencies/${fixedAgencyId}/commercials` : '/commercials');

  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
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

  const [prospectOpen, setProspectOpen] = useState(false);
  const [prospectEditingId, setProspectEditingId] = useState<string | null>(null);
  const [prospectForm, setProspectForm] = useState<ProspectForm>(EMPTY_PROSPECT_FORM);
  const [prospectErrors, setProspectErrors] = useState<Record<string, string>>({});
  const [prospectSubmitting, setProspectSubmitting] = useState(false);
  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);
  const [convertSubmitting, setConvertSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Prospect | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );
  const canManageProspects = canManage || currentUser?.role?.name === 'commercial';
  const canAdjustPoints = ['super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  async function fetchAll() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [c, s] = await Promise.all([commercialApi.get(id), commercialApi.stats(id)]);
      setCommercial(c);
      setStats(s);
      try {
        const res = await invoicesApi.list({ commercial_id: id, per_page: 10 });
        setInvoices(res.invoices.data);
      } catch {
        setInvoices([]);
      } finally {
        setInvoicesLoading(false);
      }
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
      await commercialApi.update(id, payload);
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
      await commercialApi.adjustPoints(id, value);
      showToast(t('commercials.adjusted'), 'success');
      setAdjustOpen(false);
      fetchAll();
    } catch (error) {
      setAdjustError(extractErrorMessage(error, t('commercials.adjustFailed')));
    } finally {
      setAdjustSubmitting(false);
    }
  }

  function openAddProspect() {
    setProspectForm(EMPTY_PROSPECT_FORM);
    setProspectEditingId(null);
    setProspectErrors({});
    setProspectOpen(true);
  }

  function openEditProspect(p: Prospect) {
    setProspectForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      city: p.city ?? '',
      country: p.country ?? '',
      address: p.address ?? '',
      notes: p.notes ?? '',
    });
    setProspectEditingId(p.id);
    setProspectErrors({});
    setProspectOpen(true);
  }

  async function handleProspectSubmit(event: FormEvent) {
    event.preventDefault();
    setProspectSubmitting(true);
    setProspectErrors({});
    const payload = {
      first_name: prospectForm.first_name,
      last_name: prospectForm.last_name,
      email: prospectForm.email || null,
      phone: prospectForm.phone || null,
      city: prospectForm.city || null,
      country: prospectForm.country || null,
      address: prospectForm.address || null,
      notes: prospectForm.notes || null,
    };
    try {
      if (prospectEditingId) {
        await prospectsApi.update(prospectEditingId, payload);
        showToast(t('prospects.updated'), 'success');
      } else {
        await prospectsApi.create({ ...payload, commercial_id: id });
        showToast(t('prospects.created'), 'success');
      }
      setProspectOpen(false);
      fetchAll();
    } catch (error) {
      setProspectErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('prospects.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setProspectSubmitting(false);
    }
  }

  async function handleConvert(prospect: Prospect) {
    setConvertSubmitting(true);
    try {
      await prospectsApi.convert(prospect.id);
      showToast(t('prospects.converted'), 'success');
      setConvertTarget(null);
      fetchAll();
    } catch (error) {
      showToast(extractErrorMessage(error, t('prospects.convertFailed')), 'error');
    } finally {
      setConvertSubmitting(false);
    }
  }

  async function handleDeleteProspect(prospect: Prospect) {
    setDeleteSubmitting(true);
    try {
      await prospectsApi.remove(prospect.id);
      showToast(t('prospects.deleted'), 'success');
      setDeleteTarget(null);
      fetchAll();
    } catch (error) {
      showToast(extractErrorMessage(error, t('prospects.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
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
      case 'prospect':
        return t('commercials.pointsReasonProspect');
      case 'conversion':
        return t('commercials.pointsReasonConversion');
      default:
        return reason;
    }
  }

  const monthlyPoints = useMemo(() => {
    if (!commercial?.points || commercial.points.length === 0) return [];
    const byMonth: Record<string, number> = {};
    commercial.points.forEach((p) => {
      const d = new Date(p.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + p.points;
    });
    const sorted = Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6);
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return sorted.map(([month, value]) => {
      const [y, m] = month.split('-');
      return { month, value, label: `${MONTHS[Number(m) - 1]} ${y.slice(2)}` };
    });
  }, [commercial?.points]);

  const maxAbsPoints = useMemo(() => {
    if (monthlyPoints.length === 0) return 0;
    return Math.max(...monthlyPoints.map((m) => Math.abs(m.value)));
  }, [monthlyPoints]);

  if (isLoading) {
    return (
      <SkeletonDetail />
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
          {backToListLabel ?? t('commercials.title')}
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
          {backToListLabel ?? t('commercials.title')}
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
                  {t('commercials.linkedUser')} : {[commercial.user.first_name, commercial.user.last_name].filter(Boolean).join(' ') || commercial.user.email}
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

      {commercial.user && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <BadgeCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                {t('commercials.linkedUser')} : {[commercial.user.first_name, commercial.user.last_name].filter(Boolean).join(' ') || commercial.user.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{commercial.user.email}</p>
            </div>
          </div>
        </div>
      )}

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
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('prospects.title')}
          </h2>
          {canManageProspects && (
            <Button variant="outline" size="sm" onClick={openAddProspect}>
              <UserPlus className="h-4 w-4" />
              {t('prospects.addProspect')}
            </Button>
          )}
        </div>
        {!commercial.prospects || commercial.prospects.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('prospects.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('prospects.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('prospects.colContact')}</th>
                  <th className="px-5 py-3 font-medium">{t('prospects.colCity')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {commercial.prospects.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {[p.first_name, p.last_name].filter(Boolean).join(' ')}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      <div>{p.email || '—'}</div>
                      {p.phone && <div className="text-xs text-gray-400">{p.phone}</div>}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {p.city || '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canManageProspects && (
                          <Button variant="primary" size="sm" onClick={() => setConvertTarget(p)}>
                            <UserPlus className="h-3.5 w-3.5" />
                            {t('prospects.becomeClient')}
                          </Button>
                        )}
                        {canManageProspects && (
                          <button
                            type="button"
                            onClick={() => openEditProspect(p)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canManageProspects && (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(p)}
                            className="rounded-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('commercials.servicesSold')}
          </h2>
        </div>
        {!stats?.services_sold || stats.services_sold.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.servicesSoldEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.itemLabel')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.quantity')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.services_sold.map((s) => (
                  <tr key={s.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {s.label}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600 dark:text-gray-300">
                      {s.quantity}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(s.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('commercials.invoicesLinked')}
          </h2>
        </div>
        {invoicesLoading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">…</p>
        ) : invoices.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.invoicesLinkedEmpty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {inv.number}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatRelativeDate(inv.invoice_date)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {inv.client_label ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <InvoiceStatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {t('common.open')}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {monthlyPoints.length > 0 && (
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('commercials.pointsChart')}
            </h2>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-end gap-2 h-28">
              {monthlyPoints.map((m) => (
                <div key={m.month} className="flex flex-col items-center flex-1">
                  <span className="text-xs font-medium text-gray-500">
                    {m.value > 0 ? '+' : ''}{m.value}
                  </span>
                  <div
                    className="mt-1 w-full rounded-t"
                    style={{
                      height: `${maxAbsPoints > 0 ? (Math.abs(m.value) / maxAbsPoints) * 80 : 0}px`,
                      minHeight: m.value !== 0 ? '4px' : '0px',
                      backgroundColor: m.value >= 0 ? '#10b981' : '#ef4444',
                    }}
                  />
                  <span className="mt-1 text-[10px] text-gray-400">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('commercials.commissionsHistory')}
          </h2>
        </div>
        {!commercial.commission_payments || commercial.commission_payments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.noCommissions')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.paymentDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.paymentAmount')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.commissionPerTranche')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercials.colCommission')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {commercial.commission_payments.map((cp) => (
                  <tr key={cp.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-800 dark:text-gray-100">{cp.invoice?.number ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {formatRelativeDate(cp.created_at)}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(cp.base_amount)}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {cp.rule === 'percent' ? `${cp.rate}%` : cp.rule === 'fixed' ? t('commercials.commissionFixed') : t('services.bonusFixed')}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-success-600">{formatCurrency(cp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
        isOpen={prospectOpen}
        onClose={() => setProspectOpen(false)}
        title={prospectEditingId ? t('prospects.editTitle') : t('prospects.createTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleProspectSubmit} className="flex flex-col gap-4">
          {Object.keys(prospectErrors).length > 0 && (
            <Alert variant="error">{Object.values(prospectErrors).join(' ')}</Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('prospects.firstName')}
              required
              value={prospectForm.first_name}
              onChange={(e) => setProspectForm((p) => ({ ...p, first_name: e.target.value }))}
              error={prospectErrors.first_name}
            />
            <Input
              label={t('prospects.lastName')}
              required
              value={prospectForm.last_name}
              onChange={(e) => setProspectForm((p) => ({ ...p, last_name: e.target.value }))}
              error={prospectErrors.last_name}
            />
          </div>
          <Input
            label={t('prospects.email')}
            type="email"
            value={prospectForm.email}
            onChange={(e) => setProspectForm((p) => ({ ...p, email: e.target.value }))}
            error={prospectErrors.email}
          />
          <Input
            label={t('prospects.phone')}
            value={prospectForm.phone}
            onChange={(e) => setProspectForm((p) => ({ ...p, phone: e.target.value }))}
            error={prospectErrors.phone}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('prospects.city')}
              value={prospectForm.city}
              onChange={(e) => setProspectForm((p) => ({ ...p, city: e.target.value }))}
            />
            <Input
              label={t('prospects.country')}
              value={prospectForm.country}
              onChange={(e) => setProspectForm((p) => ({ ...p, country: e.target.value }))}
            />
          </div>
          <Input
            label={t('prospects.address')}
            value={prospectForm.address}
            onChange={(e) => setProspectForm((p) => ({ ...p, address: e.target.value }))}
          />
          <Input
            label={t('prospects.notes')}
            value={prospectForm.notes}
            onChange={(e) => setProspectForm((p) => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setProspectOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={prospectSubmitting} className="flex-1">
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={convertTarget !== null}
        title={t('prospects.convertTitle')}
        message={t('prospects.convertMessage', {
          name: convertTarget ? [convertTarget.first_name, convertTarget.last_name].filter(Boolean).join(' ') : '',
        })}
        variant="primary"
        confirmLabel={t('prospects.becomeClient')}
        isLoading={convertSubmitting}
        onCancel={() => setConvertTarget(null)}
        onConfirm={() => convertTarget && handleConvert(convertTarget)}
      />

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={t('prospects.deleteTitle')}
        message={t('prospects.deleteMessage', {
          name: deleteTarget ? [deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' ') : '',
        })}
        isLoading={deleteSubmitting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDeleteProspect(deleteTarget)}
      />

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
