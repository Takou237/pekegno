import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LayoutDashboard,
  FolderTree,
  Package,
  Users,
  Settings,
  Briefcase,
  FileText,
  Calculator,
  CalendarCheck,
  BarChart3,
  Contact,
} from 'lucide-react';
import { countriesApi } from '@/api/countries.api';
import { extractErrorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { UserMenu } from '@/components/common/UserMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import type { CountryStat } from '@/types/stats';

function getSubItems(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: 'clients', label: t('nav.clients'), icon: Contact, end: false },
    { to: 'agencies', label: t('nav.agencies'), icon: FolderTree, end: false },
    { to: 'users', label: t('nav.users'), icon: Users, end: false },
    { to: 'privileges', label: t('nav.privileges'), icon: Users, end: false },
    { to: 'catalog', label: t('nav.catalog'), icon: Package, end: false },
    { to: 'accounting', label: t('nav.accounting'), icon: Calculator, end: false },
    { to: 'bilans', label: t('nav.bilans'), icon: BarChart3, end: false },
    { to: 'subscriptions', label: t('nav.subscriptions'), icon: CalendarCheck, end: false },
    { to: 'commercials/report', label: t('nav.commercialReport'), icon: Briefcase, end: false },
    { to: 'audit', label: t('nav.audit'), icon: FileText, end: false },
    { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
  ];
}

export function CountryLayout() {
  const { t } = useTranslation();
  const { countryId } = useParams<{ countryId: string }>();
  const [country, setCountry] = useState<CountryStat | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadCountry = useCallback(() => {
    if (!countryId) return;
    setIsLoading(true);
    setLoadError(null);
    countriesApi
      .get(countryId)
      .then(setCountry)
      .catch((error) => setLoadError(extractErrorMessage(error, t('countries.empty'))))
      .finally(() => setIsLoading(false));
  }, [countryId, t]);

  useEffect(() => {
    loadCountry();
  }, [loadCountry]);

  function subLinkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  const subItems = getSubItems(t);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex items-center gap-2">
          <MobileNav contextOnly contextTitle={country?.name} contextItems={subItems} />
          <Link
            to="/countries"
            className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('countries.title')}</span>
          </Link>
        </div>
        <UserMenu />
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <div className="flex flex-col gap-6 lg:w-72 lg:shrink-0">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : loadError || !country ? (
              <p className="text-sm text-error-500">{loadError ?? t('countries.empty')}</p>
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  {country.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">{country.name}</p>
                  <p className="font-mono text-xs text-gray-400">{country.code}</p>
                </div>
              </div>
            )}
          </div>

          <nav className="hidden flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 lg:flex dark:border-gray-800 dark:bg-gray-900">
            {subItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to || '/'} to={to} end={end} className={subLinkClass}>
                <Icon className="h-5 w-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <Outlet context={{ country, countryId, refreshCountry: loadCountry }} />
          )}
        </div>
      </main>
    </div>
  );
}
