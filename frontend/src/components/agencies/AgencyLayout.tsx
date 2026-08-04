import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LayoutDashboard,
  FolderTree,
  Package,
  Users,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { UserMenu } from '@/components/common/UserMenu';
import type { Agency } from '@/types/agency';

function getSubItems(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { to: '', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: 'departments', label: t('nav.departments'), icon: FolderTree, end: false },
    { to: 'services', label: t('nav.services'), icon: Package, end: false },
    { to: 'teams', label: t('nav.teams'), icon: Users, end: false },
  ];
}

export function AgencyLayout() {
  const { t } = useTranslation();
  const { agencyId } = useParams<{ agencyId: string }>();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    agenciesApi
      .get(agencyId)
      .then(setAgency)
      .catch((error) => setLoadError(extractErrorMessage(error, t('agencies.loadFailed'))))
      .finally(() => setIsLoading(false));
  }, [agencyId, t]);

  function subLinkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <Link
          to="/agencies"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('agencies.backToList')}
        </Link>
        <UserMenu />
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <div className="flex flex-col gap-6 lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : loadError || !agency ? (
              <p className="text-sm text-error-500">{loadError ?? t('agencies.empty')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                    {agency.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {agency.name}
                    </h1>
                    <p className="font-mono text-xs text-gray-400">{agency.code}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                    {agency.country}
                    {agency.city ? `, ${agency.city}` : ''}
                  </span>
                  {agency.phone && (
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0 text-gray-400" />
                      {agency.phone}
                    </span>
                  )}
                  {agency.email && (
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                      <span className="truncate">{agency.email}</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <nav className="flex flex-col gap-1">
            {getSubItems(t).map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to || '/'} to={to} end={end} className={subLinkClass}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="min-w-0 flex-1">
          <Outlet context={{ agency, agencyId }} />
        </div>
      </main>
    </div>
  );
}
