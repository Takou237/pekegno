import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  FolderTree,
  Users,
  TrendingUp,
  Wallet,
  Clock,
  ArrowRight,
  Receipt,
  UserCheck,
  Trophy,
  CalendarCheck,
  UserPlus,
  Percent,
  ShoppingBag,
  Globe,
  BookOpen,
  CalendarDays,
  DollarSign,
  GraduationCap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import { statsApi } from '@/api/stats.api';
import { invoicesApi, type InvoiceIndexResponse } from '@/api/invoices.api';
import { countriesApi } from '@/api/countries.api';
import { agenciesApi } from '@/api/agencies.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import { PeriodPicker, defaultPeriod, type Period } from '@/components/ui/PeriodPicker';
import { formatCurrency, formatNumber } from '@/utils/number';
import type { GroupStats, MonthlyRevenuePoint, CategorySales, PaymentMethodStat, TopCommercial, TopProduct, TopAgency, TrainingGroupStats, ServiceGroupStats, GroupReportStats, AcademyAgencyStat, CountryStat } from '@/types/stats';
import type { Invoice } from '@/types/invoice';
import type { Agency } from '@/types/agency';
import type { ReactNode } from 'react';

const MODE_COLORS: Record<string, string> = {
  in_person: '#6366f1',
  online: '#22c55e',
  mixed: '#f59e0b',
};

const STATUS_COLORS: Record<string, string> = {
  planned: '#3b82f6',
  ongoing: '#f59e0b',
  completed: '#22c55e',
  cancelled: '#ef4444',
};

function StatCard({
  label,
  value,
  icon,
  tone,
  sub,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  tone: string;
  sub?: string;
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
          {sub && <p className="truncate text-xs text-gray-400">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

export default function PEKEGNOGroupDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<GroupStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenuePoint[]>([]);
  const [categories, setCategories] = useState<CategorySales[]>([]);
  const [payments, setPayments] = useState<PaymentMethodStat[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [topCommercials, setTopCommercials] = useState<TopCommercial[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topAgencies, setTopAgencies] = useState<TopAgency[]>([]);
  const [training, setTraining] = useState<TrainingGroupStats | null>(null);
  const [services, setServices] = useState<ServiceGroupStats | null>(null);
  const [academyAgencies, setAcademyAgencies] = useState<AcademyAgencyStat[]>([]);
  const [academyRanking, setAcademyRanking] = useState<AcademyAgencyStat[]>([]);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [academyCountry, setAcademyCountry] = useState('');
  const [academyAgencyId, setAcademyAgencyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadErrors, setLoadErrors] = useState<string[]>([]);
  const [period, setPeriod] = useState<Period>(defaultPeriod());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadErrors([]);
    const range = { from: period.from, to: period.to };

    const results = [
      { key: 'group', fn: () => statsApi.group(range) },
      { key: 'monthlyRevenue', fn: () => statsApi.monthlyRevenue({ months: 12 }) },
      { key: 'salesByCategory', fn: () => statsApi.salesByCategory(range) },
      { key: 'paymentMethods', fn: () => statsApi.paymentMethods(range) },
      { key: 'topCommercials', fn: () => statsApi.topCommercials({ limit: 5, ...range }) },
      { key: 'topProducts', fn: () => statsApi.topProducts({ limit: 5, ...range }) },
      { key: 'topAgencies', fn: () => statsApi.topAgencies({ limit: 5, ...range }) },
      { key: 'training', fn: () => statsApi.trainingGroup() },
      { key: 'invoices', fn: () => invoicesApi.list({ per_page: 8 }) },
    ];

    Promise.allSettled(results.map((r) => r.fn()))
      .then((settled) => {
        if (!active) return;
        settled.forEach((result, i) => {
          const key = results[i].key;
          if (result.status === 'fulfilled') {
            switch (key) {
              case 'group':
                setStats(result.value as GroupStats);
                break;
              case 'monthlyRevenue':
                setMonthly(result.value as MonthlyRevenuePoint[]);
                break;
              case 'salesByCategory':
                setCategories(result.value as CategorySales[]);
                break;
              case 'paymentMethods':
                setPayments(result.value as PaymentMethodStat[]);
                break;
              case 'topCommercials':
                setTopCommercials(result.value as TopCommercial[]);
                break;
              case 'topProducts':
                setTopProducts(result.value as TopProduct[]);
                break;
              case 'topAgencies':
                setTopAgencies(result.value as TopAgency[]);
                break;
              case 'training': {
                const res = result.value as GroupReportStats;
                setTraining(res.training);
                setServices(res.services);
                break;
              }
              case 'invoices':
                setRecentInvoices((result.value as InvoiceIndexResponse).invoices.data ?? []);
                break;
            }
          } else {
            const errMsg =
              result.reason?.response?.data?.message ??
              result.reason?.message ??
              JSON.stringify(result.reason).slice(0, 120);
            setLoadErrors((prev) => [...prev, `${key}: ${errMsg}`]);
          }
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [period]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      countriesApi.list({ per_page: 100 }).then((r) => r.data),
      agenciesApi.list({ per_page: 100 }).then((r) => r.data),
    ]).then((settled) => {
      if (!active) return;
      if (settled[0].status === 'fulfilled') setCountries(settled[0].value as CountryStat[]);
      if (settled[1].status === 'fulfilled') setAgencies(settled[1].value as Agency[]);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    statsApi
      .trainingAgency({
        country_id: academyCountry || undefined,
        agency_id: academyAgencyId || undefined,
      })
      .then((res) => {
        if (!active) return;
        setAcademyAgencies(res.academies.agencies ?? []);
        setAcademyRanking(res.academies.ranking ?? []);
      })
      .catch(() => {
        if (!active) return;
        setAcademyAgencies([]);
        setAcademyRanking([]);
      });
    return () => {
      active = false;
    };
  }, [academyCountry, academyAgencyId]);

  if (loading) return <SkeletonDashboard />;

  const totalMethods = payments.reduce((sum, p) => sum + p.total, 0);

  const trainingModeName = (mode: string) =>
    mode === 'in_person' ? t('academy.modeInPerson') : mode === 'online' ? t('academy.modeOnline') : t('academy.modeMixed');
  const trainingStatusName = (status: string) =>
    t(`academy.status${status.charAt(0).toUpperCase()}${status.slice(1)}`);

  const monthlyTrend = (training?.monthly_trend ?? []).map((m) => ({
    month: new Date(`${m.month}-01`).toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    }),
    inscriptions: m.inscriptions,
  }));
  const modeBreakdown = (training?.mode_breakdown ?? []).map((m) => ({
    name: trainingModeName(m.mode),
    value: m.value,
    color: MODE_COLORS[m.mode] ?? '#9ca3af',
  }));
  const sessionsByStatus = (training?.sessions_by_status ?? []).map((s) => ({
    name: trainingStatusName(s.status),
    value: s.value,
    color: STATUS_COLORS[s.status] ?? '#9ca3af',
  }));

  const CATEGORY_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6'];
  const serviceMonthly = (services?.monthly_revenue ?? []).map((m) => ({
    month: new Date(`${m.month}-01`).toLocaleDateString(undefined, {
      month: 'short',
      year: '2-digit',
    }),
    revenue: m.revenue,
  }));
  const serviceCategories = (services?.by_category ?? []).map((c, idx) => ({
    name: c.category,
    value: Math.round(c.revenue),
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  return (
    <div className="flex flex-col gap-6">
      {loadErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          <p className="font-semibold">{t('dashboard.loadErrors')}</p>
          <ul className="mt-1 list-inside list-disc">
            {loadErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            PEKEGNO Group
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.groupSubtitle')}
          </p>
        </div>
        {stats && (
          <PeriodPicker value={period} onChange={setPeriod} />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.netCollected')}
          value={formatCurrency(stats?.net_cash ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
          sub={`${t('dashboard.expenses')}: ${formatCurrency(stats?.expenses_total ?? 0)}`}
        />
        <StatCard
          label={t('dashboard.paymentsTotal')}
          value={formatCurrency(stats?.payments_total ?? 0)}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={formatCurrency(stats?.outstanding ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
        <StatCard
          label={t('dashboard.invoicesTotal')}
          value={String(stats?.invoices_total ?? 0)}
          icon={<Receipt className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
          sub={`${stats?.invoices_paid ?? 0} ${t('dashboard.cashier.todayPaid')}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.agencies')}
          value={String(stats?.agencies_total ?? 0)}
          icon={<Building2 className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('dashboard.departments')}
          value={String(stats?.departments_total ?? 0)}
          icon={<FolderTree className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
        <StatCard
          label={t('dashboard.users')}
          value={String(stats?.users_total ?? 0)}
          icon={<Users className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('dashboard.clients')}
          value={String(stats?.clients_total ?? 0)}
          icon={<UserCheck className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.subscriptionsActive')}
          value={String(stats?.subscriptions_active ?? 0)}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        />
        <StatCard
          label={t('dashboard.newClients')}
          value={String(stats?.new_clients ?? 0)}
          icon={<UserPlus className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
        <StatCard
          label={t('dashboard.averageInvoiceValue')}
          value={formatCurrency(stats?.average_invoice_value ?? 0)}
          icon={<Receipt className="h-5 w-5" />}
          tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
        />
        <StatCard
          label={t('dashboard.collectionRate')}
          value={`${stats?.collection_rate ?? 0}%`}
          icon={<Percent className="h-5 w-5" />}
          tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <Trophy className="h-4 w-4 text-amber-500" />
            {t('dashboard.bestCommercial')}
          </h2>
          {topCommercials.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topCommercials.map((c, idx) => (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {c.full_name}
                    </p>
                    {c.agency && <p className="truncate text-xs text-gray-400">{c.agency}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(c.turnover)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.sales_count} {t('dashboard.sales')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <ShoppingBag className="h-4 w-4 text-brand-500" />
            {t('dashboard.topProducts')}
          </h2>
          {topProducts.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.topProducts')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.quantity')}</th>
                    <th className="pb-2 text-right font-medium">{t('dashboard.turnover')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topProducts.map((p) => (
                    <tr key={p.label}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                        {p.label}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{p.quantity}</td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <Building2 className="h-4 w-4 text-brand-500" />
            {t('dashboard.topAgencies')}
          </h2>
          {topAgencies.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {topAgencies.map((a, idx) => (
                <Link
                  key={a.id}
                  to={a.country_id ? `/countries/${a.country_id}/agencies/${a.id}` : '/agencies'}
                  className="flex items-center gap-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {a.name}
                    </p>
                    <p className="truncate text-xs text-gray-400">{a.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(a.revenue)}
                    </p>
                    <p className="text-xs text-gray-400">
                      {a.invoices_count} {t('dashboard.invoices')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            <Globe className="h-4 w-4 text-brand-500" />
            {t('dashboard.byCountry')}
          </h2>
          {(stats?.countries ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {(stats?.countries ?? []).map((c) => {
                const max = Math.max(1, ...(stats?.countries ?? []).map((x) => x.revenue));
                const pct = Math.max(0, Math.min(100, (c.revenue / max) * 100));
                return (
                  <Link key={c.id} to={`/countries/${c.id}`} className="group">
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-gray-600 group-hover:text-brand-600 dark:text-gray-300">
                        {c.name}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {formatCurrency(c.revenue)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className="h-full rounded-full bg-brand-500/80"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {c.agencies_count} {t('dashboard.agencies').toLowerCase()} ·{' '}
                      {c.invoices_count} {t('dashboard.invoices').toLowerCase()}
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <MonthlyRevenueChart data={monthly} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('dashboard.paymentMethods')}
          </h2>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {payments.map((p) => (
                <div key={p.method}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-300">{p.method}</span>
                    <span className="font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(p.total)}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-full rounded-full bg-brand-500/80"
                      style={{ width: `${totalMethods > 0 ? (p.total / totalMethods) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatNumber(p.count)} {t('dashboard.invoices')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('dashboard.salesByCategory')}
          </h2>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.category')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.items')}</th>
                    <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {categories.map((c) => (
                    <tr key={c.category}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                        {c.category}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{c.items}</td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(c.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {t('dashboard.recentInvoices')}
            </h2>
            <Link
              to="/invoices"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {t('dashboard.viewAllAgencies')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {recentInvoices.length === 0 ? (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.invoices')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('dashboard.clients')}</th>
                    <th className="pb-2 pr-4 font-medium">{t('common.status')}</th>
                    <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recentInvoices.map((inv) => (
                    <tr key={inv.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                        <Link to={`/invoices/${inv.id}`} className="hover:text-brand-600">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {inv.client_label ?? '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {inv.status === 'paid' ? (
                          <Badge variant="success">{t('dashboard.invoicesPaid')}</Badge>
                        ) : inv.status === 'partial' ? (
                          <Badge variant="warning">{t('dashboard.invoicesPartial')}</Badge>
                        ) : (
                          <Badge variant="error">{t('dashboard.invoicesUnpaid')}</Badge>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(inv.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 pt-2">
          <GraduationCap className="h-5 w-5 text-brand-500" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('dashboard.academyGroup')}
          </h2>
        </div>

        {training && services ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('reports.totalFormations')}
                value={String(training.summary.courses)}
                icon={<BookOpen className="h-5 w-5" />}
                tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              />
              <StatCard
                label={t('reports.totalSessions')}
                value={String(training.summary.sessions)}
                icon={<CalendarDays className="h-5 w-5" />}
                tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
              />
              <StatCard
                label={t('reports.totalEnrollments')}
                value={String(training.summary.enrollments)}
                icon={<Users className="h-5 w-5" />}
                tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
              />
              <StatCard
                label={t('reports.avgAttendanceRate')}
                value={`${training.avg_attendance}%`}
                icon={<UserCheck className="h-5 w-5" />}
                tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
              />
              <StatCard
                label={t('reports.receivedRevenue')}
                value={formatCurrency(training.received)}
                icon={<DollarSign className="h-5 w-5" />}
                tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
              />
              <StatCard
                label={t('reports.outstanding')}
                value={formatCurrency(training.outstanding)}
                icon={<TrendingUp className="h-5 w-5" />}
                tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
              />
              <StatCard
                label={t('reports.trainers')}
                value={String(training.trainers)}
                icon={<GraduationCap className="h-5 w-5" />}
                tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              />
              <StatCard
                label={t('reports.avgFillRate')}
                value={`${training.avg_fill_rate}%`}
                icon={<Percent className="h-5 w-5" />}
                tone="bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.trendTitle')}
                </h2>
                {monthlyTrend.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="inscriptions"
                        stroke="#6366f1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.modeBreakdown')}
                </h2>
                {modeBreakdown.every((m) => m.value === 0) ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={modeBreakdown}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {modeBreakdown.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex justify-center gap-4">
                      {modeBreakdown.map((m) => (
                        <span
                          key={m.name}
                          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                          {m.name} ({formatNumber(m.value)})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.topCourses')}
                </h2>
                {training.top_courses.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={training.top_courses} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                        width={120}
                      />
                      <Tooltip />
                      <Bar dataKey="inscriptions" fill="#22c55e" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.sessionsByStatus')}
                </h2>
                {sessionsByStatus.every((s) => s.value === 0) ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={sessionsByStatus}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="value" name={t('reports.totalSessions')} radius={[4, 4, 0, 0]}>
                        {sessionsByStatus.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.revenueByCourse')}
                </h2>
                {training.revenue_by_course.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={training.revenue_by_course} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                        width={120}
                      />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="revenu" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.attendanceByCourse')}
                </h2>
                {training.attendance_by_course.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {training.attendance_by_course.map((a) => (
                      <div key={a.name}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-gray-600 dark:text-gray-300">{a.name}</span>
                          <span className="font-semibold text-gray-900 dark:text-white">{a.rate}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className="h-2 rounded-full bg-cyan-500"
                            style={{ width: `${Math.min(100, a.rate)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <ShoppingBag className="h-5 w-5 text-brand-500" />
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                {t('services.title')}
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label={t('reports.totalServices')}
                value={String(services.summary.total)}
                icon={<ShoppingBag className="h-5 w-5" />}
                tone="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
              />
              <StatCard
                label={t('reports.servicesSold')}
                value={String(services.summary.sold)}
                icon={<BookOpen className="h-5 w-5" />}
                tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
              />
              <StatCard
                label={t('reports.serviceRevenue')}
                value={formatCurrency(services.summary.revenue)}
                icon={<DollarSign className="h-5 w-5" />}
                tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                sub={`${t('reports.seminars')}: ${services.summary.seminars}`}
              />
              <StatCard
                label={t('reports.serviceInvoices')}
                value={String(services.summary.invoices)}
                icon={<Receipt className="h-5 w-5" />}
                tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.serviceRevenueMonth')}
                </h2>
                {serviceMonthly.every((m) => m.revenue === 0) ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={serviceMonthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Line
                        type="monotone"
                        dataKey="revenue"
                        stroke="#14b8a6"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.serviceCategoryBreakdown')}
                </h2>
                {serviceCategories.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={serviceCategories}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={2}
                        >
                          {serviceCategories.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-3 flex flex-wrap justify-center gap-4">
                      {serviceCategories.map((m) => (
                        <span
                          key={m.name}
                          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: m.color }}
                          />
                          {m.name} ({formatCurrency(m.value)})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.topServices')}
                </h2>
                {services.top_services.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={services.top_services} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis type="number" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                        width={120}
                      />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="revenue" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {t('reports.serviceVolume')}
                </h2>
                {services.top_services.length === 0 ? (
                  <p className="flex h-44 items-center justify-center text-sm text-gray-400">
                    {t('dashboard.noData')}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                        <tr>
                          <th className="pb-2 pr-4 font-medium">{t('services.title')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('reports.quantity')}</th>
                          <th className="pb-2 pr-4 font-medium">{t('dashboard.invoices')}</th>
                          <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {services.top_services.map((s) => (
                          <tr key={s.name}>
                            <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                              {s.name}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                              {formatNumber(s.quantity)}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                              {formatNumber(s.invoices)}
                            </td>
                            <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                              {formatCurrency(s.revenue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 pt-2">
            <Building2 className="h-5 w-5 text-brand-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t('dashboard.academyAgencies')}
            </h2>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('dashboard.byCountry')}</span>
              <select
                value={academyCountry}
                onChange={(e) => { setAcademyCountry(e.target.value); setAcademyAgencyId(''); }}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">{t('dashboard.allCountries')}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('dashboard.agencies')}</span>
              <select
                value={academyAgencyId}
                onChange={(e) => setAcademyAgencyId(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <option value="">{t('dashboard.allAgencies')}</option>
                {agencies
                  .filter((a) => !academyCountry || a.country_id === academyCountry)
                  .map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
              </select>
            </label>
          </div>
        </div>

        {academyAgencies.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label={t('reports.totalFormations')}
                value={String(academyAgencies.reduce((s, a) => s + a.courses, 0))}
                icon={<BookOpen className="h-5 w-5" />}
                tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
              />
              <StatCard
                label={t('reports.totalSessions')}
                value={String(academyAgencies.reduce((s, a) => s + a.sessions, 0))}
                icon={<CalendarDays className="h-5 w-5" />}
                tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
              />
              <StatCard
                label={t('dashboard.learners')}
                value={String(academyAgencies.reduce((s, a) => s + a.learners, 0))}
                icon={<Users className="h-5 w-5" />}
                tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
              />
              <StatCard
                label={t('reports.receivedRevenue')}
                value={formatCurrency(academyAgencies.reduce((s, a) => s + a.received, 0))}
                icon={<DollarSign className="h-5 w-5" />}
                tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  {t('dashboard.academyRanking')}
                </h2>
                <div className="flex flex-col gap-2">
                  {academyRanking.map((a, idx) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{a.name}</p>
                        <p className="truncate text-xs text-gray-400">
                          {a.courses} {t('dashboard.formations').toLowerCase()} · {a.sessions} {t('dashboard.sessions')} ·{' '}
                          {a.learners} {t('dashboard.learners').toLowerCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(a.received)}</p>
                        <p className="text-xs text-gray-400">{t('reports.attendanceRate')} {a.attendance_rate}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  <Building2 className="h-4 w-4 text-brand-500" />
                  {t('dashboard.academyCards')}
                </h2>
                {academyAgencies.length === 0 ? (
                  <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {academyAgencies.map((a) => {
                      const max = Math.max(1, ...academyAgencies.map((x) => x.received));
                      return (
                        <div key={a.id} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{a.name}</p>
                            <p className="shrink-0 text-sm font-semibold text-gray-900 dark:text-white">{formatCurrency(a.received)}</p>
                          </div>
                          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                            <div className="h-full rounded-full bg-brand-500/80" style={{ width: `${Math.min(100, (a.received / max) * 100)}%` }} />
                          </div>
                          <p className="mt-1.5 text-xs text-gray-400">
                            {a.country} · {a.learners} {t('dashboard.learners').toLowerCase()} ·{' '}
                            {t('reports.outstanding')}: {formatCurrency(a.outstanding)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
