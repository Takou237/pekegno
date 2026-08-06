import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  Settings,
} from 'lucide-react';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { UserMenu } from '@/components/common/UserMenu';
import { MobileNav } from '@/components/layout/MobileNav';
import { DepartmentSwitcher } from '@/components/departments/DepartmentSwitcher';
import type { Department } from '@/types/department';

function getSubItems(t: ReturnType<typeof useTranslation>['t']) {
  return [
    { to: '', label: t('nav.overview'), icon: LayoutDashboard, end: true },
    { to: 'team', label: t('nav.teams'), icon: Users, end: false },
    { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
  ];
}

export function DepartmentLayout() {
  const { t } = useTranslation();
  const { departmentId } = useParams<{ departmentId: string }>();
  const location = useLocation();
  const [backTo] = useState(
    () => (location.state as { from?: string } | null)?.from ?? '/departments'
  );
  const [department, setDepartment] = useState<Department | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDepartment = useCallback(() => {
    if (!departmentId) return;
    setIsLoading(true);
    setLoadError(null);
    departmentsApi
      .get(departmentId)
      .then(setDepartment)
      .catch((error) => setLoadError(extractErrorMessage(error, t('departments.loadFailed'))))
      .finally(() => setIsLoading(false));
  }, [departmentId, t]);

  useEffect(() => {
    loadDepartment();
  }, [loadDepartment]);

  function subLinkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6">
        <div className="flex items-center gap-2">
          <MobileNav contextOnly contextTitle={department?.name} contextItems={getSubItems(t)} />
          <Link
            to={backTo}
            className="inline-flex items-center gap-1.5 rounded-lg p-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('departments.backToDepartments')}</span>
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
            ) : loadError || !department ? (
              <p className="text-sm text-error-500">{loadError ?? t('departments.empty')}</p>
            ) : (
              <DepartmentSwitcher department={department} />
            )}
          </div>

          <nav className="hidden flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 lg:flex dark:border-gray-800 dark:bg-gray-900">
            {getSubItems(t).map(({ to, label, icon: Icon, end }) => (
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
            <Outlet context={{ department, departmentId, refreshDepartment: loadDepartment }} />
          )}
        </div>
      </main>
    </div>
  );
}
