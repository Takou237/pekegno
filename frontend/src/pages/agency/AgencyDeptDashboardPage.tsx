import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Banknote, CalendarClock, FileSignature, Repeat, Star, TrendingUp, Wallet, Briefcase } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { PeriodPicker, defaultPeriod, type Period } from '@/components/ui/PeriodPicker';
import { Alert } from '@/components/ui/Alert';
import { RatingSummaryCard } from '@/components/agencyDept/StarRating';
import type { AgencyReport } from '@/types/agencyDepartment';

function Kpi({ icon: Icon, label, value, hint, to }: { icon: typeof Wallet; label: string; value: string; hint?: string; to?: string }) {
  const body = (
    <div className="flex h-full flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <span className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</span>
      {hint && <span className="text-xs text-gray-400">{hint}</span>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

/** Tableau de bord du département Agency (§6.1). */
export default function AgencyDeptDashboardPage() {
  const { t } = useTranslation();
  const { department, departmentId, basePath } = useAgencyDept();
  const [report, setReport] = useState<AgencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(defaultPeriod());

  useEffect(() => {
    if (!departmentId) return;
    setReport(null);
    setError(null);
    agencyDeptApi
      .report({ department_id: departmentId, from: period.from, to: period.to })
      .then(setReport)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, period, t]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!report) return <SkeletonDashboard />;

  const k = report.kpis;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{department?.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.dashboard.subtitle')}</p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={TrendingUp} label={t('agencyDept.dashboard.revenue')} value={formatCurrency(k.revenue)} hint={t('agencyDept.dashboard.revenueHint')} />
        <Kpi icon={Banknote} label={t('agencyDept.dashboard.collected')} value={formatCurrency(k.collected)} hint={`${t('agencyDept.dashboard.passThrough')} : ${formatCurrency(k.pass_through_collected)}`} />
        <Kpi icon={Wallet} label={t('agencyDept.dashboard.receivables')} value={formatCurrency(k.receivables)} to={`${basePath}/receivables`} />
        <Kpi icon={Repeat} label={t('agencyDept.dashboard.mrr')} value={formatCurrency(k.mrr)} />
        <Kpi icon={FileSignature} label={t('agencyDept.dashboard.activeContracts')} value={String(k.active_contracts)} to={`${basePath}/contracts`} />
        <Kpi icon={CalendarClock} label={t('agencyDept.dashboard.toRenew')} value={String(k.contracts_to_renew)} to={`${basePath}/renewals`} />
        <Kpi icon={Briefcase} label={t('agencyDept.dashboard.inProgress')} value={String(k.prestations_in_progress)} to={`${basePath}/prestations`} />
        <Kpi icon={AlertTriangle} label={t('agencyDept.dashboard.overdueActions')} value={String(k.overdue_actions)} to={`${basePath}/community`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <Star className="h-4 w-4 text-amber-400" /> {t('agencyDept.dashboard.satisfaction')}
          </h2>
          <RatingSummaryCard summary={report.rating} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">{t('agencyDept.dashboard.topCommercials')}</h2>
          <TopList rows={report.top_commercials} empty={t('agencyDept.empty')} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 font-semibold text-gray-900 dark:text-white">{t('agencyDept.dashboard.topPackages')}</h2>
          <TopList rows={report.top_packages} empty={t('agencyDept.empty')} />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-2 font-semibold text-gray-900 dark:text-white">{t('agencyDept.dashboard.budget')}</h2>
        <BudgetBar total={report.budget.total} allocated={report.budget.allocated} spent={report.budget.spent} />
      </div>
    </div>
  );
}

function TopList({ rows, empty }: { rows: Array<{ id: string; name: string; contracts: number; amount: number }>; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
          <span className="truncate text-gray-700 dark:text-gray-200">{r.name}</span>
          <span className="whitespace-nowrap text-gray-500 dark:text-gray-400">{r.contracts} · {formatCurrency(r.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Barre budget : alloué aux actions / dépensé, sur le budget total. */
export function BudgetBar({ total, allocated, spent }: { total: number; allocated: number; spent: number }) {
  const { t } = useTranslation();
  const pct = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="absolute inset-y-0 left-0 bg-brand-200 dark:bg-brand-500/30" style={{ width: `${pct(allocated)}%` }} />
        <div className="absolute inset-y-0 left-0 bg-brand-500" style={{ width: `${pct(spent)}%` }} />
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
        <span>{t('agencyDept.budget.total')} : {formatCurrency(total)}</span>
        <span>{t('agencyDept.budget.allocated')} : {formatCurrency(allocated)}</span>
        <span>{t('agencyDept.budget.remaining')} : {formatCurrency(total - allocated)}</span>
        <span>{t('agencyDept.budget.spent')} : {formatCurrency(spent)}</span>
      </div>
    </div>
  );
}
