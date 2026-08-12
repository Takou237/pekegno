import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FolderTree, Users, Mail, Phone, BadgeInfo, ArrowRight, TrendingUp, Wallet, HandCoins, Clock, Trophy, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { client } from '@/api/client';
import { statsApi } from '@/api/stats.api';
import { SkeletonDashboard,
  SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';
import type { Agency } from '@/types/agency';
import type { DashboardStats, MonthlyRevenuePoint, CategorySales, PaymentMethodStat, AgencyStats } from '@/types/stats';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

function roleBadge(roleName: string | null | undefined, t: (key: string, opts?: any) => string) {
  switch (roleName) {
    case 'super-admin': return <Badge variant="error">{t('roles.super-admin')}</Badge>;
    case 'direction-generale': return <Badge variant="brand">{t('roles.direction-generale')}</Badge>;
    case 'responsable-agence': return <Badge variant="warning">{t('roles.responsable-agence')}</Badge>;
    case 'responsable-departement': return <Badge variant="warning">{t('roles.responsable-departement')}</Badge>;
    case 'commercial': return <Badge variant="success">{t('roles.commercial')}</Badge>;
    case 'caissier': return <Badge variant="neutral">{t('roles.caissier')}</Badge>;
    case 'comptable': return <Badge variant="neutral">{t('roles.comptable')}</Badge>;
    case 'formateur': return <Badge variant="brand">{t('roles.formateur')}</Badge>;
    default: return <Badge variant="neutral">{t('roles.none')}</Badge>;
  }
}

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

function AdminDashboard() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenuePoint[]>([]);
  const [categories, setCategories] = useState<CategorySales[]>([]);
  const [payments, setPayments] = useState<PaymentMethodStat[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      statsApi.dashboard(),
      statsApi.monthlyRevenue({ months: 12 }),
      statsApi.salesByCategory(),
      statsApi.paymentMethods(),
      client.get('/agencies', { params: { per_page: 12, sort_by: 'created_at', sort_order: 'desc' } }),
    ])
      .then(([d, m, c, pm, al]) => {
        if (!active) return;
        setStats(d);
        setMonthly(m);
        setCategories(c);
        setPayments(pm);
        setAgencies(al.data.data ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <SkeletonDashboard />
    );
  }

  const totalMethods = payments.reduce((sum, p) => sum + p.total, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('dashboard.title')}</h1>
        {stats && (
          <span className="text-sm text-gray-400">
            {t('dashboard.thisPeriod')} :{' '}
            {new Date(stats.period.from).toLocaleDateString(currentLocale())} →{' '}
            {new Date(stats.period.to).toLocaleDateString(currentLocale())}
          </span>
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
          sub={t('dashboard.invoicesUnpaid')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to="/agencies" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.agencies_total ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.agencies')}</p>
            </div>
          </div>
        </Link>
        <Link to="/departments" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.departments_total ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.departments')}</p>
            </div>
          </div>
        </Link>
        <Link to="/users" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.users_total ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.users')}</p>
            </div>
          </div>
        </Link>
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
                    {p.count} {t('dashboard.invoices')}
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
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.category}</td>
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
              {t('dashboard.topCommercials')}
            </h2>
            <Link
              to="/commercials"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {t('dashboard.viewAllAgencies')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {stats?.top_commercials?.length ? (
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
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{c.points_balance}</td>
                      <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                        {formatCurrency(c.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">{t('dashboard.noData')}</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('dashboard.agencies')}
          </h2>
          <Link
            to="/agencies"
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
                to={`/agencies/${a.id}`}
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
                    {a.country ? ` · ${a.country}${a.city ? `, ${a.city}` : ''}` : ''}
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

function AgencyChiefDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const assignments = user?.assignments?.filter((a: any) => a.pivot?.is_primary === true) ?? [];
  const [agency, setAgency] = useState<Agency | null>(null);
  const [agencyStats, setAgencyStats] = useState<AgencyStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assignments.length === 0) { setLoading(false); return; }
    const agencyId = assignments[0].id;
    Promise.all([
      client.get(`/agencies/${agencyId}`),
      statsApi.agency(agencyId),
      statsApi.monthlyRevenue({ months: 12, agencyId }),
    ])
      .then(([a, s, m]) => {
        setAgency(a.data.data ?? a.data);
        setAgencyStats(s);
        setMonthly(m);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignments]);

  if (loading) return <SkeletonTable rows={3} />;
  if (!agency) return <p className="text-sm text-gray-400">{t('dashboard.noAgencyAssigned')}</p>;

  const deptCount = agency.departments?.length ?? 0;
  const userCount = agency.assigned_users?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{agency.name}</h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          {agency.code}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.revenue')}
          value={formatCurrency(agencyStats?.revenue ?? 0)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('dashboard.salesCount')}
          value={String(agencyStats?.sales_count ?? 0)}
          icon={<HandCoins className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
        <StatCard
          label={t('dashboard.outstanding')}
          value={formatCurrency(agencyStats?.outstanding ?? 0)}
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {agencyStats?.top_commercials?.length ?? 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.topCommercials')}</p>
            </div>
          </div>
        </div>
      </div>

      <MonthlyRevenueChart data={monthly} />

      {agencyStats && agencyStats.top_commercials.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {t('dashboard.topCommercials')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="pb-2 pr-4 font-medium">{t('dashboard.commercials')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('dashboard.salesCount')}</th>
                  <th className="pb-2 text-right font-medium">{t('dashboard.revenue')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {agencyStats.top_commercials.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{c.full_name}</td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{c.sales_count}</td>
                    <td className="py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(c.turnover)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to={`/departments?agency_id=${agency.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{deptCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.departments')}</p>
            </div>
          </div>
        </Link>
        <Link to={`/users?agency_id=${agency.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{userCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.users')}</p>
            </div>
          </div>
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{agency.country}</p>
              <p className="text-xs text-gray-400">{agency.city ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.info')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">{t('dashboard.address')}</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.full_address ?? '—'}</span></div>
          <div><span className="text-gray-400">{t('dashboard.phone')}</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.phone ?? '—'}</span></div>
          <div><span className="text-gray-400">{t('dashboard.email')}</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.email ?? '—'}</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {t('dashboard.departmentsCount', { count: deptCount })}
        </h2>
        {deptCount > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {agency.departments?.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{d.name}</span>
                <span className="text-xs text-gray-400">{d.description ?? '—'}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('dashboard.noDepartments')}</p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          {t('dashboard.usersCount', { count: userCount })}
        </h2>
        {userCount > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <th className="pb-2 pr-4 font-medium">{t('users.colName')}</th>
                  <th className="pb-2 pr-4 font-medium">{t('users.colEmail')}</th>
                  <th className="pb-2 font-medium">{t('users.colRole')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {agency.assigned_users?.map((u: any) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{u.email}</td>
                    <td className="py-2.5">{roleBadge(u.role?.name, t)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t('dashboard.noUsersAssigned')}</p>
        )}
      </div>
    </div>
  );
}

function DeptChiefDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const deptChiefAssignments = (user?.assignments ?? []).filter(
    (a: any) => a.pivot?.is_department_chief === true
  );
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (deptChiefAssignments.length === 0) { setLoading(false); return; }
    client.get('/departments?per_page=100')
      .then(({ data }) => setDepts(data.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <SkeletonTable rows={3} />;
  if (depts.length === 0) return <p className="text-sm text-gray-400">{t('dashboard.noDepartmentAssigned')}</p>;

  const totalUsers = depts.reduce((sum, d) => sum + (d.user_count ?? d.assigned_users?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.myDepartments')}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{depts.length}</p>
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
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('dashboard.users')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{depts[0]?.agency?.name ?? '—'}</p>
              <p className="text-xs text-gray-400">{t('dashboard.linkedAgency')}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {depts.map((d) => (
          <div key={d.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{d.name}</h2>
                <p className="text-xs text-gray-400">{d.description ?? d.agency?.name ?? '—'}</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                {t('dashboard.userCount', { count: d.user_count ?? d.assigned_users?.length ?? 0 })}
              </span>
            </div>
            <Link
              to={`/users?department_id=${d.id}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              <Users className="h-4 w-4" />
              {t('dashboard.viewUsers')}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        {t('dashboard.welcome', { name: user?.first_name ?? user?.username })}
      </h1>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.myProfile')}</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm">
            <BadgeInfo className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{user?.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">{user?.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">{t('dashboard.role')}</span>
            {roleBadge(user?.role?.name, t)}
          </div>
        </div>
      </div>

      {user?.assignments && user.assignments.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('dashboard.myAssignments')}</h2>
          <div className="flex flex-col gap-2">
            {user.assignments.map((a: any) => (
              <div key={a.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-800/50">
                <p className="font-medium text-gray-800 dark:text-gray-100">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.pivot?.is_primary ? t('dashboard.agencyChief') : ''}
                  {a.pivot?.is_department_chief ? t('dashboard.departmentChief') : ''}
                  {!a.pivot?.is_primary && !a.pivot?.is_department_chief ? t('dashboard.member') : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const roleName = user?.role?.name;

  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return <AdminDashboard />;
  }
  if (roleName === 'responsable-agence') {
    return <AgencyChiefDashboard />;
  }
  if (roleName === 'responsable-departement') {
    return <DeptChiefDashboard />;
  }
  return <UserDashboard />;
}
