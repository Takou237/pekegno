import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  GraduationCap,
  UserCog,
  Wallet,
  Clock,
  UserCheck,
  BadgeCheck,
  Mail,
  Phone,
  Layers,
  ShoppingBag,
  Coins,
  TrendingUp,
  Pencil,
  Plus,
  X,
  Save,
  RefreshCw,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type TrainerSessionItem, type TrainerStats } from '@/api/academy.api';
import { commissionsApi } from '@/api/commissions.api';
import { sellerProfilesApi } from '@/api/sellerProfiles.api';
import { servicesApi } from '@/api/services.api';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { useToast } from '@/hooks/useToast';
import type { CommissionEntry, CommissionRule, CommissionRulePayload } from '@/types/commissions';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SessionTable({
  title,
  icon,
  sessions,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  sessions: TrainerSessionItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();

  function statusBadge(status: TrainerSessionItem['status']) {
    switch (status) {
      case 'ongoing':
        return <Badge variant="warning">{t('academy.statusOngoing')}</Badge>;
      case 'completed':
        return <Badge variant="success">{t('academy.statusCompletedSession')}</Badge>;
      case 'cancelled':
        return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
      default:
        return <Badge variant="brand">{t('academy.statusPlanned')}</Badge>;
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.enrollmentsCount')}</th>
                <th className="pb-2 font-medium">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {session.course?.name ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {new Date(session.start_at).toLocaleString(currentLocale(), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {session.enrollments_count}
                  </td>
                  <td className="py-2.5">{statusBadge(session.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function InvoiceStatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();

  switch (status) {
    case 'paid':
      return <Badge variant="success">{t('invoices.statusPaid')}</Badge>;
    case 'partial':
      return <Badge variant="warning">{t('invoices.statusPartial')}</Badge>;
    case 'cancelled':
      return <Badge variant="error">{t('invoices.statusCancelled')}</Badge>;
    default:
      return <Badge variant="neutral">{t('invoices.statusUnpaid')}</Badge>;
  }
}

function EntryStatusBadge({ status }: { status: CommissionEntry['status'] }) {
  const { t } = useTranslation();

  switch (status) {
    case 'calculated':
      return <Badge variant="neutral">{t('commissions.statusCalculated')}</Badge>;
    case 'validated':
      return <Badge variant="brand">{t('commissions.statusValidated')}</Badge>;
    case 'paid':
      return <Badge variant="success">{t('commissions.statusPaid')}</Badge>;
    default:
      return <Badge variant="error">{t('commissions.statusCancelled')}</Badge>;
  }
}

export default function AcademyTrainerDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { trainerId } = useParams<{ trainerId: string }>();
  const [data, setData] = useState<TrainerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pilotage des commissions : entrées du profil vendeur du formateur.
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [addingEntry, setAddingEntry] = useState(false);
  const [addCategory, setAddCategory] = useState<'training' | 'service'>('training');
  const [addAmount, setAddAmount] = useState('');
  const [addLabel, setAddLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editLabel, setEditLabel] = useState('');

  // Profil vendeur : taux de commission (modifiable depuis la fiche).
  const [commissionType, setCommissionType] = useState<'percent' | 'fixed' | 'none'>('none');
  const [commissionValue, setCommissionValue] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Règles ciblées (service / formation) du profil vendeur.
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [addingRule, setAddingRule] = useState(false);
  const [ruleTarget, setRuleTarget] = useState<'course' | 'service'>('course');
  const [ruleCourseId, setRuleCourseId] = useState('');
  const [ruleCourseLabel, setRuleCourseLabel] = useState('');
  const [ruleServiceId, setRuleServiceId] = useState('');
  const [ruleServiceLabel, setRuleServiceLabel] = useState('');
  const [ruleFormula, setRuleFormula] = useState<'percent' | 'fixed'>('percent');
  const [ruleValue, setRuleValue] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('on_payment');

  // Recalcul idempotent des commissions sur les versements existants.
  const [isRecalculating, setIsRecalculating] = useState(false);

  const sellerProfileId = data?.stats.seller_profile_id ?? null;

  useEffect(() => {
    const profile = data?.stats.seller_profile;
    setCommissionType(profile?.commission_type ?? 'none');
    setCommissionValue(profile ? String(profile.commission_value) : '');
    setRuleCourseId('');
    setRuleCourseLabel('');
    setRuleServiceId('');
    setRuleServiceLabel('');
  }, [data]);

  useEffect(() => {
    if (!trainerId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    academyApi
      .trainerStats(trainerId)
      .then((response) => {
        if (active) setData(response);
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [trainerId, t]);

  useEffect(() => {
    if (!sellerProfileId) {
      setEntries([]);
      return;
    }
    let active = true;
    commissionsApi
      .listEntries({ seller_profile_id: sellerProfileId, per_page: 200 })
      .then((res) => {
        if (active) setEntries(res.data ?? []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sellerProfileId]);

  useEffect(() => {
    if (!sellerProfileId) {
      setRules([]);
      return;
    }
    let active = true;
    commissionsApi
      .listRules()
      .then((all) => {
        if (active) {
          setRules(
            (all ?? []).filter(
              (rule) => rule.beneficiary_seller_profile_id === sellerProfileId && rule.is_active,
            ),
          );
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [sellerProfileId]);

  async function reloadEntries() {
    if (!sellerProfileId) return;
    try {
      const res = await commissionsApi.listEntries({ seller_profile_id: sellerProfileId, per_page: 200 });
      setEntries(res.data ?? []);
    } catch {
      // silencieux : le tableau reste inchangé
    }
  }

  async function handleAddEntry() {
    if (!sellerProfileId) return;
    const amount = Number(addAmount);
    if (!amount || amount <= 0) {
      showToast(t('academy.entryAmount'), 'error');
      return;
    }
    try {
      await commissionsApi.createEntry({
        seller_profile_id: sellerProfileId,
        category: addCategory,
        amount,
        label: addLabel.trim() || undefined,
      });
      setAddAmount('');
      setAddLabel('');
      setAddingEntry(false);
      showToast(t('academy.entryAdded'), 'success');
      await reloadEntries();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function handleSaveAmount(entryId: string) {
    const amount = Number(editAmount);
    if (!amount || amount <= 0) return;
    try {
      await commissionsApi.updateEntryAmount(entryId, {
        amount,
        label: editLabel.trim() || undefined,
      });
      setEditingId(null);
      showToast(t('academy.entryAmountUpdated'), 'success');
      await reloadEntries();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function handleEntryAction(entryId: string, action: 'validate' | 'pay' | 'cancel') {
    try {
      if (action === 'validate') await commissionsApi.validateEntry(entryId);
      else if (action === 'pay') await commissionsApi.payEntry(entryId);
      else await commissionsApi.cancelEntry(entryId);
      await reloadEntries();
      if (action !== 'validate') await refreshStats();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function refreshStats() {
    if (!trainerId) return;
    try {
      const response = await academyApi.trainerStats(trainerId);
      setData(response);
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.loadFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function handleSaveProfile() {
    if (!sellerProfileId) return;
    const value = commissionType === 'none' ? 0 : Number(commissionValue);
    if (commissionType !== 'none' && (!Number.isFinite(value) || value < 0)) {
      showToast(t('academy.entryAmount'), 'error');
      return;
    }
    setIsSavingProfile(true);
    try {
      await sellerProfilesApi.update(sellerProfileId, {
        commission_type: commissionType,
        commission_value: value,
      });
      showToast(t('academy.profileSaved'), 'success');
      await refreshStats();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  }

  function fetchCourseOptions(query: string): Promise<AutocompleteOption[]> {
    return academyApi.courses({ search: query || undefined, per_page: 20 }).then((res) =>
      res.data.map((course) => ({ id: course.id, label: course.name, subtitle: course.code })),
    );
  }

  function fetchServiceOptions(query: string): Promise<AutocompleteOption[]> {
    return servicesApi.search(query).then((items) =>
      items.map((service) => ({ id: service.id, label: service.name, subtitle: service.category ?? undefined })),
    );
  }

  async function handleAddRule() {
    if (!sellerProfileId) return;
    const value = Number(ruleValue);
    const targetLabel = ruleTarget === 'course' ? ruleCourseLabel : ruleServiceLabel;
    if (ruleTarget === 'course' && !ruleCourseId) {
      showToast(t('academy.ruleSelectCourseFirst'), 'error');
      return;
    }
    if (ruleTarget === 'service' && !ruleServiceId) {
      showToast(t('academy.ruleSelectServiceFirst'), 'error');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      showToast(t('academy.entryAmount'), 'error');
      return;
    }
    const fullName = [data?.trainer.first_name, data?.trainer.last_name].filter(Boolean).join(' ') || data?.trainer.email;
    const payload: CommissionRulePayload = {
      name: `${fullName || t('academy.trainer')} — ${targetLabel}`,
      beneficiary_seller_profile_id: sellerProfileId,
      trigger_event: ruleTrigger,
      formula_type: ruleFormula,
      ...(ruleTarget === 'course' ? { course_id: ruleCourseId } : { service_id: ruleServiceId }),
      ...(ruleFormula === 'percent' ? { percent_value: value } : { fixed_amount: value }),
    };
    try {
      const rule = await commissionsApi.createRule(payload);
      setRules((prev) => [rule, ...prev]);
      setAddingRule(false);
      setRuleCourseId('');
      setRuleCourseLabel('');
      setRuleServiceId('');
      setRuleServiceLabel('');
      setRuleValue('');
      showToast(t('commissions.ruleCreated'), 'success');
      await refreshStats();
      await reloadEntries();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function handleDeactivateRule(ruleId: string) {
    try {
      await commissionsApi.deactivateRule(ruleId);
      setRules((prev) => prev.filter((rule) => rule.id !== ruleId));
      showToast(t('commissions.ruleDeactivated'), 'success');
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.saveFailed'));
      if (msg) showToast(msg, 'error');
    }
  }

  async function handleRecalculate() {
    if (!sellerProfileId) return;
    setIsRecalculating(true);
    try {
      const result = await commissionsApi.recalculateSeller(sellerProfileId);
      showToast(
        t('academy.recalcDone', { created: result.created, payments: result.payments }),
        'success',
      );
      await refreshStats();
      await reloadEntries();
    } catch (error) {
      const msg = extractErrorMessage(error, t('academy.recalcFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setIsRecalculating(false);
    }
  }

  if (isLoading) return <SkeletonDashboard />;

  if (loadError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.trainers')}
        </button>
        <p className="text-sm text-error-500">{loadError ?? t('academy.loadFailed')}</p>
      </div>
    );
  }

  const { trainer, stats } = data;
  const fullName =
    [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email;
  const initials =
    [trainer.first_name, trainer.last_name]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';

  const statusBars = [
    { key: 'planned' as const, label: t('academy.statusPlanned'), color: 'bg-brand-500' },
    { key: 'ongoing' as const, label: t('academy.statusOngoing'), color: 'bg-warning-500' },
    { key: 'completed' as const, label: t('academy.statusCompletedSession'), color: 'bg-success-500' },
    { key: 'cancelled' as const, label: t('academy.statusCancelled'), color: 'bg-error-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('nav.trainers')}
      </button>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-50 text-lg font-semibold text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
              {trainer.is_active ? (
                <Badge variant="success">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('common.active')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('common.inactive')}</Badge>
              )}
              {trainer.has_account ? (
                <Badge variant="brand">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('academy.hasAccount')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('academy.noAccount')}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {trainer.email}
              </span>
              {trainer.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {trainer.phone}
                </span>
              )}
              {trainer.created_at && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {t('academy.memberSince')}:{' '}
                  {new Date(trainer.created_at).toLocaleDateString(currentLocale(), { dateStyle: 'long' })}
                </span>
              )}
            </div>
            {trainer.bio && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{trainer.bio}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('nav.sessions')}
          value={stats.sessions_total}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('academy.sessionsUpcoming')}
          value={stats.sessions_upcoming}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('academy.learnersTrained')}
          value={stats.learners_unique}
          icon={<UserCog className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('academy.potentialRevenue')}
          value={formatCurrency(stats.potential_revenue)}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <ShoppingBag className="h-4 w-4" />
            {t('academy.salesFormations')}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 xl:grid-cols-4">
            <StatCard
              label={t('academy.salesCount')}
              value={stats.formation_sales.count}
              icon={<ShoppingBag className="h-5 w-5" />}
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            />
            <StatCard
              label={t('academy.salesTurnover')}
              value={formatCurrency(stats.formation_sales.turnover)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            />
            <StatCard
              label={t('academy.salesPaid')}
              value={stats.formation_sales.paid_count}
              icon={<BadgeCheck className="h-5 w-5" />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            />
            <StatCard
              label={t('academy.salesPaidTurnover')}
              value={formatCurrency(stats.formation_sales.paid_turnover)}
              icon={<Wallet className="h-5 w-5" />}
              tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            {data.recent_formation_sales.length === 0 ? (
              <p className="text-sm text-gray-400">{t('academy.noSales')}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('academy.learner')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                    <th className="pb-2 pr-4 text-right font-medium">{t('employees.statsTurnover')}</th>
                    <th className="pb-2 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.recent_formation_sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                        {sale.course?.name ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {[sale.learner?.first_name, sale.learner?.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {sale.date
                          ? new Date(sale.date).toLocaleDateString(currentLocale(), { dateStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-800 dark:text-gray-100">
                        {formatCurrency(sale.amount)}
                      </td>
                      <td className="py-2.5">
                        <InvoiceStatusBadge status={sale.invoice_status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Coins className="h-4 w-4" />
            {t('academy.salesServices')}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t('academy.salesCount')}
              value={stats.service_sales.count}
              icon={<Coins className="h-5 w-5" />}
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            />
            <StatCard
              label={t('academy.salesTurnover')}
              value={formatCurrency(stats.service_sales.turnover)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            />
            <StatCard
              label={t('academy.salesPaid')}
              value={stats.service_sales.paid_count}
              icon={<BadgeCheck className="h-5 w-5" />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            />
            <StatCard
              label={t('academy.salesPaidTurnover')}
              value={formatCurrency(stats.service_sales.paid_turnover)}
              icon={<Wallet className="h-5 w-5" />}
              tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            {data.recent_service_sales.length === 0 ? (
              <p className="text-sm text-gray-400">{t('academy.noSales')}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('academy.saleNumber')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('academy.entryLabel')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('academy.learner')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                    <th className="pb-2 pr-4 text-right font-medium">{t('employees.statsTurnover')}</th>
                    <th className="pb-2 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.recent_service_sales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{sale.number}</td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{sale.label || '—'}</td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {[sale.client?.first_name, sale.client?.last_name].filter(Boolean).join(' ') || '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {sale.date
                          ? new Date(sale.date).toLocaleDateString(currentLocale(), { dateStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-800 dark:text-gray-100">
                        {formatCurrency(sale.amount)}
                      </td>
                      <td className="py-2.5">
                        <InvoiceStatusBadge status={sale.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            <Wallet className="h-4 w-4" />
            {t('academy.manageCommissions')}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label={t('academy.totalTraining')}
              value={formatCurrency(stats.commissions_training)}
              icon={<Coins className="h-5 w-5" />}
              tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            />
            <StatCard
              label={t('academy.totalService')}
              value={formatCurrency(stats.commissions_service)}
              icon={<Coins className="h-5 w-5" />}
              tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
            />
            <StatCard
              label={t('academy.commissionsPaid')}
              value={formatCurrency(stats.commissions_paid)}
              icon={<BadgeCheck className="h-5 w-5" />}
              tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
            />
            <StatCard
              label={t('academy.commissionsBalance')}
              value={formatCurrency(stats.commissions_balance)}
              icon={<TrendingUp className="h-5 w-5" />}
              tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
            />
          </div>

          {sellerProfileId && data.stats.seller_profile && (
            <div className="mt-5 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                {t('academy.sellerCommissionEdit')}
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">{t('academy.sellerCommissionHint')}</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="w-full sm:w-52">
                  <Select
                    label={t('academy.commissionType')}
                    value={commissionType}
                    onChange={(e) => setCommissionType(e.target.value as 'percent' | 'fixed' | 'none')}
                  >
                    <option value="percent">{t('academy.commissionPercent')}</option>
                    <option value="fixed">{t('academy.commissionFixed')}</option>
                    <option value="none">{t('academy.commissionNone')}</option>
                  </Select>
                </div>
                <div className="min-w-0 flex-1">
                  <Input
                    label={t('academy.commissionValue')}
                    type="number"
                    min={0}
                    step="0.01"
                    value={commissionValue}
                    onChange={(e) => setCommissionValue(e.target.value)}
                    disabled={commissionType === 'none'}
                  />
                </div>
                <Button type="button" onClick={handleSaveProfile} disabled={isSavingProfile}>
                  <Save className="h-4 w-4" />
                  {t('common.save')}
                </Button>
              </div>
            </div>
          )}

          {sellerProfileId && (
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {t('academy.sellerRulesTitle')}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-400">{t('academy.sellerRulesHint')}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleRecalculate}
                    disabled={isRecalculating}
                    title={t('academy.recalcCommissionsHint')}
                  >
                    <RefreshCw className={`h-4 w-4 ${isRecalculating ? 'animate-spin' : ''}`} />
                    {t('academy.recalcCommissions')}
                  </Button>
                </div>
              </div>

              {addingRule ? (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full sm:w-44">
                      <Select
                        label={t('academy.ruleTargetType')}
                        value={ruleTarget}
                        onChange={(e) => {
                          setRuleTarget(e.target.value as 'course' | 'service');
                          setRuleCourseId('');
                          setRuleCourseLabel('');
                          setRuleServiceId('');
                          setRuleServiceLabel('');
                        }}
                      >
                        <option value="course">{t('academy.categoryTraining')}</option>
                        <option value="service">{t('academy.categoryService')}</option>
                      </Select>
                    </div>
                    <div className="min-w-0 flex-1">
                      {ruleTarget === 'course' ? (
                        <Autocomplete
                          label={t('academy.ruleCourse')}
                          placeholder={t('academy.ruleSearchCoursePlaceholder')}
                          value={ruleCourseId}
                          onChange={setRuleCourseId}
                          fetchOptions={fetchCourseOptions}
                          onPick={(option) => setRuleCourseLabel(option.label)}
                        />
                      ) : (
                        <Autocomplete
                          label={t('academy.ruleService')}
                          placeholder={t('academy.ruleSearchServicePlaceholder')}
                          value={ruleServiceId}
                          onChange={setRuleServiceId}
                          fetchOptions={fetchServiceOptions}
                          onPick={(option) => setRuleServiceLabel(option.label)}
                        />
                      )}
                    </div>
                    <div className="w-full sm:w-40">
                      <Select
                        label={t('commissions.formula')}
                        value={ruleFormula}
                        onChange={(e) => setRuleFormula(e.target.value as 'percent' | 'fixed')}
                      >
                        <option value="percent">{t('commissions.formulaPercent')}</option>
                        <option value="fixed">{t('commissions.formulaFixed')}</option>
                      </Select>
                    </div>
                    <div className="w-full sm:w-36">
                      <Input
                        label={
                          ruleFormula === 'percent'
                            ? t('academy.rulePercentValue')
                            : t('academy.ruleFixedValue')
                        }
                        type="number"
                        min={0}
                        step="0.01"
                        value={ruleValue}
                        onChange={(e) => setRuleValue(e.target.value)}
                      />
                    </div>
                    <div className="w-full sm:w-44">
                      <Select
                        label={t('academy.ruleTriggerLabel')}
                        value={ruleTrigger}
                        onChange={(e) => setRuleTrigger(e.target.value)}
                      >
                        <option value="on_payment">{t('commissions.trigger_on_payment')}</option>
                        <option value="on_sale">{t('commissions.trigger_on_sale')}</option>
                        <option value="on_full_payment">{t('commissions.trigger_on_full_payment')}</option>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddingRule(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                      <Button type="button" onClick={handleAddRule}>
                        <Save className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <Button type="button" variant="outline" onClick={() => setAddingRule(true)}>
                    <Plus className="h-4 w-4" />
                    {t('academy.addRule')}
                  </Button>
                </div>
              )}

              {rules.length === 0 ? (
                <p className="text-sm text-gray-400">{t('commissions.noRules')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">{t('commissions.ruleName')}</th>
                        <th className="pb-2 pr-4 font-medium">{t('academy.ruleTargetType')}</th>
                        <th className="pb-2 pr-4 font-medium">{t('commissions.trigger')}</th>
                        <th className="pb-2 pr-4 font-medium">{t('commissions.formula')}</th>
                        <th className="pb-2 font-medium">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                            {rule.name}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                            {rule.course_id
                              ? `${t('academy.categoryTraining')} — ${rule.course?.name ?? ''}`
                              : `${t('academy.categoryService')} — ${rule.service?.name ?? ''}`}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                            {t(`commissions.trigger_${rule.trigger_event}`)}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                            {rule.formula_type === 'percent'
                              ? `${rule.percent_value ?? 0}%`
                              : formatCurrency(Number(rule.fixed_amount ?? 0))}
                          </td>
                          <td className="py-2.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeactivateRule(rule.id)}
                              title={t('academy.deactivateRule')}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {!sellerProfileId ? (
            <p className="mt-5 text-sm text-gray-400">{t('academy.noCommissionEntries')}</p>
          ) : (
            <div className="mt-5 flex flex-col gap-4">
              {addingEntry ? (
                <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800 sm:flex-row sm:items-end">
                  <div className="w-full sm:w-44">
                    <Select label={t('academy.category')} value={addCategory} onChange={(e) => setAddCategory(e.target.value as 'training' | 'service')}>
                      <option value="training">{t('academy.categoryTraining')}</option>
                      <option value="service">{t('academy.categoryService')}</option>
                    </Select>
                  </div>
                  <div className="min-w-0 flex-1">
                    <Input
                      label={t('academy.entryLabel')}
                      value={addLabel}
                      onChange={(e) => setAddLabel(e.target.value)}
                      placeholder={t('academy.entryLabel')}
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <Input
                      label={t('academy.entryAmount')}
                      type="number"
                      min={0}
                      step="0.01"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddingEntry(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button type="button" onClick={handleAddEntry}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Button type="button" variant="outline" onClick={() => setAddingEntry(true)}>
                    <Plus className="h-4 w-4" />
                    {t('academy.addCommissionEntry')}
                  </Button>
                </div>
              )}

              {entries.length === 0 ? (
                <p className="text-sm text-gray-400">{t('academy.noCommissionEntries')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="pb-2 pr-4 font-medium">{t('academy.entryLabel')}</th>
                        <th className="pb-2 pr-4 font-medium">{t('academy.category')}</th>
                        <th className="pb-2 pr-4 text-right font-medium">{t('academy.entryAmount')}</th>
                        <th className="pb-2 pr-4 font-medium">{t('common.status')}</th>
                        <th className="pb-2 font-medium">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {entries.map((entry) => {
                        const manual = entry.rule_snapshot?.label as string | undefined;
                        const isEditing = editingId === entry.id;
                        const editable = entry.status === 'calculated' || entry.status === 'validated';
                        return (
                          <tr key={entry.id}>
                            <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                              {manual ?? entry.invoice?.number ?? '—'}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                              {entry.category === 'training'
                                ? t('academy.categoryTraining')
                                : t('academy.categoryService')}
                            </td>
                            <td className="py-2.5 pr-4 text-right text-gray-800 dark:text-gray-100">
                              {isEditing ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <input
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={editAmount}
                                    onChange={(e) => setEditAmount(e.target.value)}
                                    className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-right text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                  />
                                  <input
                                    value={editLabel}
                                    onChange={(e) => setEditLabel(e.target.value)}
                                    className="w-40 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                                  />
                                </div>
                              ) : (
                                formatCurrency(Number(entry.amount))
                              )}
                            </td>
                            <td className="py-2.5 pr-4">
                              <EntryStatusBadge status={entry.status} />
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-1.5">
                                {editable && (
                                  <>
                                    {isEditing ? (
                                      <>
                                        <Button type="button" size="sm" onClick={() => handleSaveAmount(entry.id)}>
                                          <Save className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                                          <X className="h-3.5 w-3.5" />
                                        </Button>
                                      </>
                                    ) : (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        title={t('academy.editAmount')}
                                        onClick={() => {
                                          setEditingId(entry.id);
                                          setEditAmount(String(entry.amount));
                                          setEditLabel(((entry.rule_snapshot?.label as string | undefined) ?? '').toString());
                                        }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {entry.status === 'calculated' && (
                                      <Button type="button" size="sm" variant="outline" onClick={() => handleEntryAction(entry.id, 'validate')}>
                                        {t('commissions.validate')}
                                      </Button>
                                    )}
                                    {entry.status === 'validated' && (
                                      <Button type="button" size="sm" variant="outline" onClick={() => handleEntryAction(entry.id, 'pay')}>
                                        {t('commissions.pay')}
                                      </Button>
                                    )}
                                    {entry.status === 'calculated' && (
                                      <Button type="button" size="sm" variant="ghost" onClick={() => handleEntryAction(entry.id, 'cancel')}>
                                        {t('commissions.cancel')}
                                      </Button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('academy.metricsTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <GraduationCap className="h-3.5 w-3.5" />
              {t('academy.enrollmentsTotal')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.enrollments_total}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('academy.completionRate')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.completion_rate}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <UserCheck className="h-3.5 w-3.5" />
              {t('academy.attendanceRate')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.attendance_rate}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {t('academy.hoursTaught')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.hours_taught} {t('academy.hours')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {statusBars.map(({ key, label, color }) => {
            const count = stats.sessions_by_status[key] ?? 0;
            const percent =
              stats.sessions_total > 0 ? Math.round((count / stats.sessions_total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-700 dark:text-gray-200">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Layers className="h-4 w-4" />
          {t('academy.assignedModules')}
        </h2>
        {!data.assigned_modules || data.assigned_modules.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noAssignedModules')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.assigned_modules.map((module) => (
              <span
                key={module.id}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
              >
                <span className="font-medium text-gray-800 dark:text-gray-100">{module.name}</span>
                {module.course && (
                  <span className="text-xs text-gray-400">
                    {module.course.name}
                    {module.course.code ? ` · ${module.course.code}` : ''}
                  </span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <SessionTable
        title={t('academy.upcomingSessions')}
        icon={<CalendarClock className="h-4 w-4" />}
        sessions={data.upcoming_sessions}
        emptyLabel={t('academy.noUpcomingSessions')}
      />

      <SessionTable
        title={t('academy.recentSessions')}
        icon={<CalendarDays className="h-4 w-4" />}
        sessions={data.recent_sessions}
        emptyLabel={t('academy.noSessions')}
      />
    </div>
  );
}
