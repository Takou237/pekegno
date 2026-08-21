import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  FolderTree,
  Users,
  TrendingUp,
  Wallet,
  HandCoins,
  Clock,
  ArrowRight,
  Globe,
  Star,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { client } from '@/api/client';
import { statsApi } from '@/api/stats.api';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import { PeriodPicker, defaultPeriod, type Period } from '@/components/ui/PeriodPicker';
import { formatCurrency } from '@/utils/number';
import type { DashboardStats, MonthlyRevenuePoint } from '@/types/stats';
import type { Agency } from '@/types/agency';
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

export default function CountryDashboardPage() {
  const { t } = useTranslation();
  const { countryId } = useParams<{ countryId: string }>();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenuePoint[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>(defaultPeriod());

  useEffect(() => {
    if (!countryId) return;
    let active = true;
    setLoading(true);

    const results = [
      { key: 'countryStats', fn: () => statsApi.country(countryId, { from: period.from, to: period.to }) },
      { key: 'monthlyRevenue', fn: () => statsApi.monthlyRevenue({ months: 12, countryId }) },
      {
        key: 'agencies',
        fn: () =>
          client.get('/agencies', {
            params: { country_id: countryId, per_page: 12, sort_by: 'name', sort_order: 'asc' },
          }),
      },
    ];

    Promise.allSettled(results.map((r) => r.fn()))
      .then((settled) => {
        if (!active) return;
        settled.forEach((result, i) => {
          const key = results[i].key;
          if (result.status === 'fulfilled') {
            switch (key) {
              case 'countryStats':
                setStats(result.value as DashboardStats);
                break;
              case 'monthlyRevenue':
                setMonthly(result.value as MonthlyRevenuePoint[]);
                break;
              case 'agencies':
                setAgencies((result.value as any).data?.data ?? []);
                break;
            }
          } else {
            console.error(`[CountryDashboard] Failed to load ${key}:`, result.reason);
          }
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [countryId, period]);

  if (loading) return <SkeletonDashboard />;

  const countryName = (stats as any)?.country?.name ?? '';
  const countryCode = (stats as any)?.country?.code ?? '';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              <Globe className="h-4 w-4" />
              PEKEGNO Group
            </Link>
            <span className="text-sm text-gray-400">/</span>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {countryName || countryCode}
            </h1>
          </div>
          {stats && (
            <PeriodPicker value={period} onChange={setPeriod} />
          )}
        </div>
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
          label={t('dashboard.advancesTotal')}
          value={formatCurrency(stats?.advances_total ?? 0)}
          icon={<HandCoins className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={formatCurrency(stats?.outstanding ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to={`/countries/${countryId}/agencies`}
          className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.agencies_total ?? '—'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.agencies')}</p>
            </div>
          </div>
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.departments_total ?? '—'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.departments')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.users_total ?? '—'}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.users')}</p>
            </div>
          </div>
        </div>
      </div>

      <MonthlyRevenueChart data={monthly} />

      {stats && stats.top_commercials && stats.top_commercials.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('dashboard.topCommercials')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('dashboard.commercials')}</th>
                  <th className="pb-2 pr-4 font-medium">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      {t('commercials.colPoints')}
                    </span>
                  </th>
                  <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {stats.top_commercials.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                      {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {c.points_balance}
                    </td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(c.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('dashboard.agencies')}
          </h2>
          <Link
            to={`/countries/${countryId}/agencies`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('dashboard.viewAllAgencies')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {agencies.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">{t('agencies.empty')}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {agencies.map((a) => (
              <Link
                key={a.id}
                to={`/countries/${countryId}/agencies/${a.id}`}
                className="group flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:hover:border-brand-500/40"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  {a.name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
                    {a.name}
                  </span>
                  <span className="block truncate text-xs text-gray-400">
                    {a.code}
                    {a.city ? ` · ${a.city}` : ''}
                  </span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500 dark:text-gray-600" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
