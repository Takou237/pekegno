import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Building2, UserRound, Users, FolderTree, Package, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function catalogItem(t: TranslateFn) {
  return { to: '/catalog', label: t('nav.catalog'), icon: Package, end: false };
}

function getMainItems(t: TranslateFn, roleName: string | null | undefined, agencyId?: string) {
  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/agencies', label: t('nav.agencies'), icon: Building2, end: false },
      { to: '/users', label: t('nav.users'), icon: Users, end: false },
      { to: '/privileges', label: t('nav.privileges'), icon: Shield, end: false },
    ];
  }

  if (roleName === 'responsable-agence') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/agencies', label: t('nav.myAgencies'), icon: Building2, end: false },
      { to: '/departments', label: t('nav.departments'), icon: FolderTree, end: false },
      ...(agencyId
        ? [{ to: `/users?agency_id=${agencyId}`, label: t('nav.myTeam'), icon: Users, end: false as const }]
        : []),
      catalogItem(t),
    ];
  }

  if (roleName === 'responsable-departement') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/departments', label: t('nav.myDepartments'), icon: FolderTree, end: false },
      { to: '/users', label: t('nav.myTeam'), icon: Users, end: false },
      catalogItem(t),
    ];
  }

  return [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    catalogItem(t),
  ];
}

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const agencyAssignment = user?.assignments?.find((a: any) => a.pivot?.is_primary === true);
  const mainItems = getMainItems(t, user?.role?.name, agencyAssignment?.id);

  function linkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
      <div className="mb-8 px-2">
        <span className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">
          PEKEGNO
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {mainItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={linkClass}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <nav className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <NavLink to="/profile" end={false} className={linkClass}>
          <UserRound className="h-5 w-5" />
          {t('nav.myProfile')}
        </NavLink>
      </nav>
    </aside>
  );
}
