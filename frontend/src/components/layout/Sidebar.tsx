import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, UserRound, Users, FolderTree, Shield, Layers } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

function getMainItems(roleName: string | null | undefined, agencyId?: string) {
  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/agencies', label: 'Agences', icon: Building2, end: false },
      { to: '/departments', label: 'Départements', icon: FolderTree, end: false },
      { to: '/services', label: 'Services', icon: Layers, end: false },
      { to: '/users', label: 'Utilisateurs', icon: Users, end: false },
      { to: '/privileges', label: 'Privilèges', icon: Shield, end: false },
    ];
  }

  if (roleName === 'responsable-agence') {
    return [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/agencies', label: 'Mes agences', icon: Building2, end: false },
      { to: '/departments', label: 'Départements', icon: FolderTree, end: false },
      { to: '/services', label: 'Services', icon: Layers, end: false },
      ...(agencyId
        ? [{ to: `/users?agency_id=${agencyId}`, label: 'Mon équipe', icon: Users, end: false as const }]
        : []),
    ];
  }

  if (roleName === 'responsable-departement') {
    return [
      { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
      { to: '/departments', label: 'Mes départements', icon: FolderTree, end: false },
      { to: '/services', label: 'Services', icon: Layers, end: false },
      { to: '/users', label: 'Mon équipe', icon: Users, end: false },
    ];
  }

  return [
    { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  ];
}

export function Sidebar() {
  const { user } = useAuth();
  const agencyAssignment = user?.assignments?.find((a: any) => a.pivot?.is_primary === true);
  const mainItems = getMainItems(user?.role?.name, agencyAssignment?.id);

  function linkClass({ isActive }: { isActive: boolean }) {
    return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
        : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
    }`;
  }

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900 lg:flex">
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
          Mon profil
        </NavLink>
      </nav>
    </aside>
  );
}
