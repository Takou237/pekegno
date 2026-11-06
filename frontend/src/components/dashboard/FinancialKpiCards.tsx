import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ArrowDownCircle, Clock, Hourglass, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/number';

/**
 * Montants renvoyés par l'API (FinancialKpiService côté serveur) : mêmes
 * clés sur /stats/group, /stats/overview, /stats/country, /stats/agency et
 * /dashboard (kpis).
 */
export interface FinancialKpis {
  revenue?: number;
  payments_total?: number;
  recoveries_total?: number;
  advances_total?: number;
  outstanding?: number;
  expenses_total?: number;
  pending_validation_total?: number;
  pending_validation_count?: number;
  net_cash?: number;
  invoices_total?: number;
  average_basket?: number;
  control_ok?: boolean;
}

function Card({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: ReactNode; tone: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-col items-start gap-2 *:max-w-full sm:flex-row sm:items-center sm:gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
        <div className="w-full min-w-0">
          <p className="truncate text-lg font-bold text-gray-900 sm:text-2xl dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {sub && <p className="truncate text-xs text-gray-400" title={sub}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Cartes en tête de chaque tableau de bord (cahier « Corrections demandées »,
 * section 1), dans cet ordre : Chiffre d'affaires, Encaissé (dont
 * recouvrements), Acomptes, Impayés, Dépenses, En attente de validation, Net caisse.
 */
export function FinancialKpiCards({ kpis, currency }: { kpis: FinancialKpis | null | undefined; currency?: string | null }) {
  const { t } = useTranslation();
  const money = (v?: number) => formatCurrency(v ?? 0, currency);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card
          label={t('dashboard.kpi.revenue')}
          value={money(kpis?.revenue)}
          sub={t('dashboard.kpi.revenueSub', { count: kpis?.invoices_total ?? 0, basket: money(kpis?.average_basket) })}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <Card
          label={t('dashboard.kpi.collected')}
          value={money(kpis?.payments_total)}
          sub={t('dashboard.kpi.collectedSub', { amount: money(kpis?.recoveries_total) })}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
        <Card
          label={t('dashboard.kpi.advances')}
          value={money(kpis?.advances_total)}
          sub={t('dashboard.kpi.advancesSub')}
          icon={<PiggyBank className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <Card
          label={t('dashboard.kpi.outstanding')}
          value={money(kpis?.outstanding)}
          sub={t('dashboard.kpi.outstandingSub')}
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Card
          label={t('dashboard.kpi.expenses')}
          value={money(kpis?.expenses_total)}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        />
        <Card
          label={t('dashboard.kpi.pending')}
          value={money(kpis?.pending_validation_total)}
          sub={t('dashboard.kpi.pendingSub', { count: kpis?.pending_validation_count ?? 0 })}
          icon={<Hourglass className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <Card
          label={t('dashboard.kpi.netCash')}
          value={money(kpis?.net_cash)}
          sub={t('dashboard.kpi.netCashSub')}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>
      {kpis && kpis.control_ok === false && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('dashboard.kpi.controlKo')}
        </p>
      )}
    </div>
  );
}

export default FinancialKpiCards;
