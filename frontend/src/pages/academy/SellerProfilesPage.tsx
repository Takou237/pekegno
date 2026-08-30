import { Fragment, useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { sellerProfilesApi, type CommissionEntry, type CommissionPayment } from '@/api/sellerProfiles.api';
import { usersApi } from '@/api/users.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';
import { currentLocale } from '@/i18n';
import type {
  SellerProfile,
  SellerProfilePayload,
  CommissionSummary,
} from '@/types/formation';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

type SellerKind = 'trainer' | 'commercial' | 'employee';

const KINDS: SellerKind[] = ['trainer', 'commercial', 'employee'];

const KIND_LABELS = (t: ReturnType<typeof useTranslation>['t']): Record<SellerKind, string> => ({
  trainer: t('sellerProfiles.kindTrainer'),
  commercial: t('sellerProfiles.kindCommercial'),
  employee: t('sellerProfiles.kindEmployee'),
});

const KIND_BADGE_CLASSES: Record<SellerKind, string> = {
  trainer: 'bg-blue-100 text-blue-700',
  commercial: 'bg-green-100 text-green-700',
  employee: 'bg-purple-100 text-purple-700',
};

type CommissionType = 'percent' | 'fixed' | 'none';

const COMMISSION_TYPES: CommissionType[] = ['percent', 'fixed', 'none'];

const COMMISSION_TYPE_LABELS = (t: ReturnType<typeof useTranslation>['t']): Record<CommissionType, string> => ({
  percent: t('sellerProfiles.commissionPercent'),
  fixed: t('sellerProfiles.commissionFixed'),
  none: t('sellerProfiles.commissionNone'),
});

interface FormState {
  user_id: string;
  kind: SellerKind;
  commission_type: CommissionType;
  commission_value: string;
}

const emptyForm: FormState = {
  user_id: '',
  kind: 'trainer',
  commission_type: 'none',
  commission_value: '0',
};

interface PayFormState {
  amount: string;
  commission_entry_id: string;
  note: string;
}

const emptyPayForm: PayFormState = {
  amount: '',
  commission_entry_id: '',
  note: '',
};

function CommissionTrendChart({ entries }: { entries: CommissionEntry[] }) {
  const { t } = useTranslation();
  const data = useMemo(() => {
    const byMonth = new Map<string, number>();
    for (const entry of entries) {
      if (entry.status === 'cancelled') continue;
      const m = new Date(entry.created_at);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
      byMonth.set(key, (byMonth.get(key) ?? 0) + entry.amount);
    }
    return Array.from(byMonth.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8)
      .map(([k, v]) => ({
        month: new Date(`${k}-01`).toLocaleDateString(currentLocale(), { month: 'short', year: '2-digit' }),
        commissions: Math.round(v),
      }));
  }, [entries]);

  if (data.length === 0) {
    return <p className="text-sm text-gray-400">{t('academy.noCommissionData')}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
        <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="commissions" name={t('academy.commissionTrend')} fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function SellerProfilesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [profiles, setProfiles] = useState<SellerProfile[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [kindFilter, setKindFilter] = useState<'' | SellerKind>('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SellerProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [payModal, setPayModal] = useState<SellerProfile | null>(null);
  const [payForm, setPayForm] = useState<PayFormState>(emptyPayForm);
  const [isPaying, setIsPaying] = useState(false);

  const fetchProfiles = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await sellerProfilesApi.list({
        agency_id: agencyId,
        kind: kindFilter || undefined,
        page,
        per_page: 15,
      });
      setProfiles(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, kindFilter, page, t]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const userOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await usersApi.list({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((user) => ({
        id: user.id,
        label: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.name || user.email,
        subtitle: user.email,
      }));
    },
    [agencyId],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(profile: SellerProfile) {
    setEditing(profile);
    setForm({
      user_id: profile.user_id,
      kind: profile.kind,
      commission_type: profile.commission_type,
      commission_value: String(profile.commission_value),
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: SellerProfilePayload = {
      user_id: form.user_id,
      agency_id: agencyId,
      kind: form.kind,
      commission_type: form.commission_type,
      commission_value: Number(form.commission_value) || 0,
    };

    try {
      if (editing) {
        const saved = await sellerProfilesApi.update(editing.id, payload);
        setProfiles((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        const saved = await sellerProfilesApi.create(payload);
        setProfiles((prev) => [saved, ...prev]);
      }
      showToast(t('academy.saved'), 'success');
      setFormOpen(false);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(profile: SellerProfile) {
    const label = profile.user
      ? [profile.user.first_name, profile.user.last_name].filter(Boolean).join(' ')
      : profile.user_id;
    if (!window.confirm(t('academy.deleteProfileConfirm', { name: label }))) return;
    try {
      await sellerProfilesApi.remove(profile.id);
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
      showToast(t('academy.profileDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  async function toggleExpand(profile: SellerProfile) {
    if (expandedId === profile.id) {
      setExpandedId(null);
      setSummary(null);
      setEntries([]);
      setPayments([]);
      return;
    }
    setExpandedId(profile.id);
    setSummaryLoading(true);
    try {
      const data = await sellerProfilesApi.commissions(profile.id);
      setSummary(data.summary);
      setEntries(data.entries?.data ?? []);
      setPayments(data.payments?.data ?? []);
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.loadFailed')), 'error');
    } finally {
      setSummaryLoading(false);
    }
  }

  async function openPayModal(profile: SellerProfile) {
    setPayModal(profile);
    setPayForm(emptyPayForm);
  }

  async function handlePayCommission(event: FormEvent) {
    event.preventDefault();
    if (!payModal) return;
    setIsPaying(true);
    try {
      await sellerProfilesApi.payCommission(payModal.id, {
        amount: Number(payForm.amount),
        commission_entry_id: payForm.commission_entry_id || undefined,
        note: payForm.note || undefined,
      });
      showToast(t('academy.commissionPaid'), 'success');
      setPayModal(null);
      if (expandedId === payModal.id) {
        toggleExpand(payModal);
      }
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.saveFailed')), 'error');
    } finally {
      setIsPaying(false);
    }
  }

  function kindBadge(kind: string) {
    const key = kind as SellerKind;
    const label = KIND_LABELS(t)[key] ?? kind;
    const colorClass = KIND_BADGE_CLASSES[key] ?? 'bg-gray-100 text-gray-600';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {label}
      </span>
    );
  }

  function commissionDisplay(profile: SellerProfile) {
    if (profile.commission_type === 'none') return '—';
    if (profile.commission_type === 'percent') return `${profile.commission_value}%`;
    return formatCurrency(profile.commission_value);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('academy.sellerProfiles')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.sellerProfilesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newProfile')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex max-w-xs gap-3">
          <select
            value={kindFilter}
            onChange={(e) => {
              setPage(1);
              setKindFilter(e.target.value as typeof kindFilter);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">{t('academy.allKinds')}</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS(t)[k]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : profiles.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noProfiles')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('common.name')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.kind')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.commissionType')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.commissionValue')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {profiles.map((profile) => (
                  <Fragment key={profile.id}>
                    <tr
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() => toggleExpand(profile)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {expandedId === profile.id ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="font-medium text-gray-800 dark:text-gray-100">
                            {profile.user
                              ? [profile.user.first_name, profile.user.last_name].filter(Boolean).join(' ') || profile.user.email
                              : '—'}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3">{kindBadge(profile.kind)}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {COMMISSION_TYPE_LABELS(t)[profile.commission_type]}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {commissionDisplay(profile)}
                      </td>
                      <td className="px-5 py-3">
                        {profile.is_active ? (
                          <Badge variant="success">{t('common.active')}</Badge>
                        ) : (
                          <Badge variant="neutral">{t('common.inactive')}</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openPayModal(profile)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-green-600 dark:hover:bg-gray-800"
                            title={t('academy.payCommission')}
                          >
                            <Wallet className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(profile)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                            title={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(profile)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                            title={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === profile.id && (
                      <tr key={`${profile.id}-detail`}>
                        <td colSpan={6} className="border-b border-gray-100 bg-gray-50/50 px-5 py-4 dark:border-gray-800 dark:bg-gray-800/30">
                          {summaryLoading ? (
                            <SkeletonTable rows={2} />
                          ) : summary ? (
                            <div className="flex flex-col gap-4">
                              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                  <p className="text-xs text-gray-400">{t('academy.totalTraining')}</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white">{formatCurrency(summary.total_training)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                  <p className="text-xs text-gray-400">{t('academy.totalService')}</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white">{formatCurrency(summary.total_service)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                  <p className="text-xs text-gray-400">{t('academy.totalOwed')}</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white">{formatCurrency(summary.total_owed)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                  <p className="text-xs text-gray-400">{t('academy.totalPaid')}</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white">{formatCurrency(summary.total_paid)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                  <p className="text-xs text-gray-400">{t('academy.balance')}</p>
                                  <p className={`mt-1 text-lg font-semibold ${summary.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                    {formatCurrency(summary.balance)}
                                  </p>
                                </div>
                              </div>

                              {entries.length > 0 && (
                                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                                  <h4 className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                                    {t('academy.commissionTrend')}
                                  </h4>
                                  <CommissionTrendChart entries={entries} />
                                </div>
                              )}

                              {entries.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('academy.commissionEntries')}</h4>
                                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        <tr>
                                          <th className="px-3 py-2 font-medium">{t('academy.invoice')}</th>
                                          <th className="px-3 py-2 font-medium">{t('academy.category')}</th>
                                          <th className="px-3 py-2 font-medium">{t('academy.baseAmount')}</th>
                                          <th className="px-3 py-2 font-medium">{t('common.amount')}</th>
                                          <th className="px-3 py-2 font-medium">{t('common.status')}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {entries.map((entry) => (
                                          <tr key={entry.id} className="bg-white dark:bg-gray-900">
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{entry.invoice?.number ?? '—'}</td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{entry.category}</td>
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{formatCurrency(entry.base_amount)}</td>
                                            <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-100">{formatCurrency(entry.amount)}</td>
                                            <td className="px-3 py-2">
                                              <Badge variant={entry.status === 'paid' ? 'success' : entry.status === 'cancelled' ? 'error' : 'neutral'}>
                                                {entry.status}
                                              </Badge>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}

                              {payments.length > 0 && (
                                <div>
                                  <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">{t('academy.commissionPayments')}</h4>
                                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                        <tr>
                                          <th className="px-3 py-2 font-medium">{t('common.date')}</th>
                                          <th className="px-3 py-2 font-medium">{t('common.amount')}</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {payments.map((payment) => (
                                          <tr key={payment.id} className="bg-white dark:bg-gray-900">
                                            <td className="px-3 py-2 text-gray-600 dark:text-gray-300">
                                              {new Date(payment.created_at).toLocaleDateString(currentLocale(), {
                                                dateStyle: 'medium',
                                              })}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-green-600 dark:text-green-400">
                                              {formatCurrency(payment.amount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400">{t('academy.noCommissionData')}</p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={15}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('academy.editProfile') : t('academy.newProfile')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          {!editing && (
            <Autocomplete
              label={`${t('common.user')} *`}
              placeholder={t('academy.searchUserPlaceholder')}
              value={form.user_id}
              onChange={(userId) => setForm((prev) => ({ ...prev, user_id: userId }))}
              fetchOptions={userOptions}
              error={fieldErrors.user_id}
            />
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.kind')} *
            </label>
            <select
              value={form.kind}
              onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as SellerKind }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABELS(t)[k]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.commissionType')} *
            </label>
            <select
              value={form.commission_type}
              onChange={(e) => setForm((prev) => ({ ...prev, commission_type: e.target.value as CommissionType }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {COMMISSION_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {COMMISSION_TYPE_LABELS(t)[ct]}
                </option>
              ))}
            </select>
          </div>

          {form.commission_type !== 'none' && (
            <Input
              label={t('academy.commissionValue')}
              type="number"
              min="0"
              step="0.01"
              value={form.commission_value}
              onChange={(e) => setForm((prev) => ({ ...prev, commission_value: e.target.value }))}
              error={fieldErrors.commission_value}
            />
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!payModal}
        onClose={() => setPayModal(null)}
        title={t('academy.payCommission')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePayCommission} className="flex flex-col gap-4">
          <Input
            label={`${t('common.amount')} *`}
            type="number"
            min="0.01"
            step="0.01"
            required
            value={payForm.amount}
            onChange={(e) => setPayForm((prev) => ({ ...prev, amount: e.target.value }))}
          />

          <Input
            label={t('academy.commissionEntryId')}
            value={payForm.commission_entry_id}
            onChange={(e) => setPayForm((prev) => ({ ...prev, commission_entry_id: e.target.value }))}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('common.notes')}
            </label>
            <textarea
              value={payForm.note}
              onChange={(e) => setPayForm((prev) => ({ ...prev, note: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPayModal(null)} disabled={isPaying} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isPaying} className="flex-1">
              {t('academy.payCommission')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
