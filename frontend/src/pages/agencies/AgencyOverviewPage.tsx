import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FolderTree, Package, Users, MapPin, Phone, Mail } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { servicesApi } from '@/api/services.api';
import { usersApi } from '@/api/users.api';
import { Spinner } from '@/components/ui/Spinner';
import type { Agency } from '@/types/agency';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

export default function AgencyOverviewPage() {
  const { t } = useTranslation();
  const { agency, agencyId } = useOutletContext<AgencyLayoutContext>();
  const [servicesCount, setServicesCount] = useState<number | null>(null);
  const [usersCount, setUsersCount] = useState<number | null>(null);
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
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
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
    </div>
  );
}
