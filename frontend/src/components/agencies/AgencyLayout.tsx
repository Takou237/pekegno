import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  UserCheck,
  BarChart3,
  GraduationCap,
  UserCog,
  BookOpen,
  CalendarDays,
} from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { UserMenu } from '@/components/common/UserMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { AgencySwitcher } from '@/components/agencies/AgencySwitcher';
import type { Agency } from '@/types/agency';

export type AgencyLine = 'agency' | 'academy';

interface MenuItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end: boolean;
}

/** Ligne Prestations : tout ce qui se vend hors formations. */
function getAgencyItems(t: ReturnType<typeof useTranslation>['t']): MenuItem[] {
  return [
    { to: '', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: 'departments', label: t('nav.departments'), icon: FolderTree, end: false },
    { to: 'services', label: t('nav.services'), icon: Package, end: false },
    { to: 'commercials', label: t('nav.commercials'), icon: Briefcase, end: false },
    { to: 'employees', label: t('nav.employees'), icon: UserCheck, end: false },
    { to: 'invoices', label: t('nav.invoices'), icon: FileText, end: false },
    { to: 'accounting', label: t('nav.accounting'), icon: Calculator, end: false },
    { to: 'bilans', label: t('nav.bilans'), icon: BarChart3, end: false },
    { to: 'subscriptions', label: t('nav.subscriptions'), icon: CalendarCheck, end: false },
    { to: 'teams', label: t('nav.users'), icon: Users, end: false },
    { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
  ];
}

/** Ligne Formations : cours, formateurs, apprenants. */
function getAcademyItems(t: ReturnType<typeof useTranslation>['t']): MenuItem[] {
  return [
    { to: 'academy', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: 'academy/courses', label: t('nav.courses'), icon: BookOpen, end: false },
    { to: 'academy/sessions', label: t('nav.sessions'), icon: CalendarDays, end: false },
    { to: 'academy/trainers', label: t('nav.trainers'), icon: GraduationCap, end: false },
    { to: 'academy/learners', label: t('nav.learners'), icon: UserCog, end: false },
  ];
}

export function AgencyLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { agencyId, countryId } = useParams<{ agencyId: string; countryId?: string }>();
  const location = useLocation();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAgency = useCallback(() => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    agenciesApi
      .get(agencyId)
      .then(setAgency)
      .catch((error) => setLoadError(extractErrorMessage(error, t('agencies.loadFailed'))))
      .finally(() => setIsLoading(false));
  }, [agencyId, t]);

  useEffect(() => {
    loadAgency();
  }, [loadAgency]);

  function subLinkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  // La ligne active est déduite de l'URL : toute section sous /academy
  // appartient à la ligne Formations, le reste à la ligne Prestations.
  const line: AgencyLine = location.pathname.includes('/academy') ? 'academy' : 'agency';
  const subItems = line === 'academy' ? getAcademyItems(t) : getAgencyItems(t);

  const backToAgencies = countryId
    ? `/countries/${countryId}/agencies`
    : agency?.country_id
      ? `/countries/${agency.country_id}/agencies`
      : '/agencies';

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex items-center gap-2">
          <MobileNav contextOnly contextTitle={agency?.name} contextItems={subItems} />
          <Link
            to={backToAgencies}
            className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('agencies.backToList')}</span>
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
            ) : loadError || !agency ? (
              <p className="text-sm text-error-500">{loadError ?? t('agencies.empty')}</p>
            ) : (
              <>
                <AgencySwitcher agency={agency} />

                {/* Bascule entre les deux lignes de métier de l'agence */}
                <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
                  <button
                    type="button"
                    onClick={() => navigateLine('agency')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                      line === 'agency'
                        ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <Briefcase className="h-4 w-4" />
                    {t('agencies.lineAgency')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateLine('academy')}
                    className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                      line === 'academy'
                        ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-300'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    {t('agencies.lineAcademy')}
                  </button>
                </div>
              </>
            )}
          </div>

          {!isLoading && !loadError && agency && (
            <nav className="hidden flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 lg:flex dark:border-gray-800 dark:bg-gray-900">
              {subItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to || '/'} to={to} end={end} className={subLinkClass}>
                  <Icon className="h-5 w-5" />
                  {label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : (
            <Outlet context={{ agency, agencyId, line, refreshAgency: loadAgency }} />
          )}
        </div>
      </main>
    </div>
  );

  function navigateLine(target: AgencyLine) {
    if (target === line || !agencyId) return;
    // Le bouton Prestations ramène à la vue d'ensemble de l'agence,
    // le bouton Formations ouvre la vue d'ensemble Academy.
    const base = countryId
      ? `/countries/${countryId}/agencies/${agencyId}`
      : `/agencies/${agencyId}`;
    navigate(target === 'academy' ? `${base}/academy` : base);
  }
}
