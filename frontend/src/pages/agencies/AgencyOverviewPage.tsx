import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FolderTree,
  Package,
  Users,
  Tag,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  TrendingUp,
  Wallet,
  Clock,
  Trophy,
} from 'lucide-react';
import { servicesApi } from '@/api/services.api';
import { usersApi } from '@/api/users.api';
import { promotionsApi } from '@/api/promotions.api';
import { statsApi } from '@/api/stats.api';
import { currentLocale } from '@/i18n';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { MonthlyRevenueChart } from '@/components/charts/MonthlyRevenueChart';
import type { Agency } from '@/types/agency';
import type { Service } from '@/types/service';
import type { AgencyStats, MonthlyRevenuePoint } from '@/types/stats';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

function formatPrice(value: string): string {
  return `${new Intl.NumberFormat(currentLocale()).format(Number(value))} FCFA`;
}

export default function AgencyOverviewPage() {
  const { t } = useTranslation();
  const { agency, agencyId } = useOutletContext<AgencyLayoutContext>();
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
  const [promosCount, setPromosCount] = useState<number | null>(null);
  const [latestServices, setLatestServices] = useState<Service[]>([]);
  const [agencyStats, setAgencyStats] = useState<AgencyStats | null>(null);
  const [monthly, setMonthly] = useState<MonthlyRevenuePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!agencyId) return;
    setIsLoading(true);
    Promise.all([
      servicesApi
        .list({ agency_id: agencyId, per_page: 1 })
        .then((r) => setServicesCount(r.meta.total))
        .catch(() => setServicesCount(0)),
      usersApi
        .list({ agency_id: agencyId, per_page: 1 })
        .then((r) => setUsersCount(r.meta.total))
        .catch(() => setUsersCount(0)),
      promotionsApi
        .list({ agency_id: agencyId, status: 'active', per_page: 1 })
        .then((r) => setPromosCount(r.meta.total))
        .catch(() => setPromosCount(0)),
      servicesApi
        .list({ agency_id: agencyId, sort_by: 'created_at', sort_order: 'desc', per_page: 4 })
        .then((r) => setLatestServices(r.data))
        .catch(() => setLatestServices([])),
      statsApi.agency(agencyId).then(setAgencyStats).catch(() => setAgencyStats(null)),
      statsApi
        .monthlyRevenue({ months: 12, agencyId })
        .then(setMonthly)
        .catch(() => setMonthly([])),
    ]).finally(() => setIsLoading(false));
  }, [agencyId]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (!agency) {
    return <p className="text-sm text-error-500">{t('agencies.empty')}</p>;
  }

  const stats = [
    {
      label: t('nav.departments'),
      value: agency.departments.length,
      icon: FolderTree,
      to: `/agencies/${agency.id}/departments`,
      color: 'text-brand-600 dark:text-brand-400',
      bg: 'bg-brand-50 dark:bg-brand-500/10',
    },
    {
      label: t('nav.services'),
      value: servicesCount ?? 0,
      icon: Package,
      to: `/agencies/${agency.id}/services`,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    },
    {
      label: t('nav.teams'),
      value: usersCount ?? 0,
      icon: Users,
      to: `/agencies/${agency.id}/teams`,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-500/10',
    },
    {
      label: t('agencies.overviewActivePromos'),
      value: promosCount ?? 0,
      icon: Tag,
      to: `/agencies/${agency.id}/promotions`,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, to, color, bg }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg} ${color}`}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{value}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                {formatPrice(String(agencyStats?.revenue ?? 0))}
              </p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dashboard.revenue')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Wallet className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                {agencyStats?.sales_count ?? 0}
              </p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dashboard.salesCount')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <Clock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatPrice(String(agencyStats?.outstanding ?? 0))}
              </p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dashboard.outstanding')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400">
              <Trophy className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">
                {agencyStats?.top_commercials.length ?? 0}
              </p>
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{t('dashboard.topCommercials')}</p>
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
                      {formatPrice(String(c.turnover))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{agency.name}</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('agencies.colCode')}</dt>
            <dd className="mt-1 font-mono text-gray-800 dark:text-gray-100">{agency.code}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('agencies.colCountryCity')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <MapPin className="h-4 w-4 text-gray-400" />
              {agency.country}
              {agency.city ? `, ${agency.city}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('agencies.colPhone')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Phone className="h-4 w-4 text-gray-400" />
              {agency.phone ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('agencies.colEmail')}</dt>
            <dd className="mt-1 flex items-center gap-1.5 text-gray-800 dark:text-gray-100">
              <Mail className="h-4 w-4 text-gray-400" />
              {agency.email ?? '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            {t('agencies.overviewLatestServices')}
          </h2>
          <Link
            to={`/agencies/${agency.id}/services`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            {t('agencies.overviewViewAll')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {latestServices.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{t('agencies.overviewNoServices')}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {latestServices.map((service) => {
              const hasPromo = Number(service.effective_price) !== Number(service.price);
              return (
                <Link
                  key={service.id}
                  to={`/agencies/${agency.id}/services`}
                  className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 transition-shadow hover:shadow-md dark:border-gray-800"
                >
                  {service.cover_image ? (
                    <div
                      className="h-24 w-full shrink-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${service.cover_image})` }}
                      role="img"
                      aria-label={service.name}
                    />
                  ) : (
                    <div className="flex h-24 w-full shrink-0 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                      <span className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-gray-400 dark:text-gray-600">
                        PEKEGNO
                      </span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {service.name}
                      </p>
                      {hasPromo && <Badge variant="brand">{t('agencies.overviewPromo')}</Badge>}
                    </div>
                    <div className="mt-2 flex items-baseline gap-1.5">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                        {formatPrice(service.effective_price)}
                      </span>
                      {hasPromo && (
                        <span className="text-xs text-gray-400 line-through">{formatPrice(service.price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
