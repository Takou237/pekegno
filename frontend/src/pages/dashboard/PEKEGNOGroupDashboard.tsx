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
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { statsApi } from '@/api/stats.api';
import { invoicesApi, type InvoiceIndexResponse } from '@/api/invoices.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import { PeriodPicker, defaultPeriod, type Period } from '@/components/ui/PeriodPicker';
import { formatCurrency, formatNumber } from '@/utils/number';
import type { GroupStats, MonthlyRevenuePoint, CategorySales, PaymentMethodStat, TopCommercial, TopProduct, TopAgency } from '@/types/stats';
import type { Invoice } from '@/types/invoice';
import type { ReactNode } from 'react';

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

  if (loading) return <SkeletonDashboard />;

  const totalMethods = payments.reduce((sum, p) => sum + p.total, 0);

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
          label={t('dashboard.revenue')}
          value={formatCurrency(stats?.revenue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
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
    </div>
  );
}
