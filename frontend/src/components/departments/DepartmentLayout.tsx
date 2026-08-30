import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AxiosError } from 'axios';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage } from '@/api/errors';
import { Spinner } from '@/components/ui/Spinner';
import { ContextBar } from '@/components/layout/ContextBar';
import { MobileNav } from '@/components/layout/MobileNav';
import { DepartmentSwitcher } from '@/components/departments/DepartmentSwitcher';
import { getDepartmentItems, navLinkClass } from '@/components/layout/navItems';
import type { Department } from '@/types/department';

export function DepartmentLayout() {
  const { t } = useTranslation();
  const { departmentId } = useParams<{ departmentId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [backTo] = useState(
    () => (location.state as { from?: string } | null)?.from ?? '/departments'
  );
  const [department, setDepartment] = useState<Department | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const loadDepartment = useCallback(() => {
    if (!departmentId) return;
    setIsLoading(true);
    setLoadError(null);
    departmentsApi
      .get(departmentId)
      .then(setDepartment)
      .catch((error) => {
        // Département introuvable (id obsolète après reset de la base, etc.) :
        // on revient à la liste plutôt que d'afficher l'erreur brute du backend.
        if (error instanceof AxiosError && error.response?.status === 404) {
          navigate('/departments', { replace: true });
          return;
        }
        setLoadError(extractErrorMessage(error, t('departments.loadFailed')));
      })
      .finally(() => setIsLoading(false));
  }, [departmentId, t, navigate]);

  useEffect(() => {
    loadDepartment();
  }, [loadDepartment]);

  const subItems = useMemo(
    () => (department?.type ? getDepartmentItems(t, department.type) : []),
    [department?.type, t],
  );

  const backButton = (
    <Link
      to={backTo}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
    >
      <span className="hidden sm:inline">{t('departments.backToDepartments')}</span>
    </Link>
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 dark:bg-gray-950">
      <ContextBar
        leftSlot={backButton}
        onMobileMenuToggle={() => setMobileOpen((v) => !v)}
      />

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

          {!isLoading && !loadError && department && subItems.length > 0 && (
            <nav className="hidden flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-3 lg:flex dark:border-gray-800 dark:bg-gray-900">
              {subItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink key={to || '/'} to={to} end={end} className={navLinkClass}>
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
            <Outlet context={{ department, departmentId, agencyId: department?.agency_id, refreshDepartment: loadDepartment }} />
          )}
        </div>
      </main>

      {mobileOpen && (
        <MobileNav contextTitle={department?.name} contextItems={subItems} contextOnly />
      )}
    </div>
  );
}
