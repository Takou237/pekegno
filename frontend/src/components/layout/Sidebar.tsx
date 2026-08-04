import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getMainItems, navLinkClass } from '@/components/layout/navItems';

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const agencyAssignment = user?.assignments?.find((a: any) => a.pivot?.is_primary === true);
  const mainItems = getMainItems(t, user?.role?.name, agencyAssignment?.id);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
      <div className="mb-8 px-2">
        <span className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">
          PEKEGNO
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {mainItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <nav className="border-t border-gray-100 pt-4 dark:border-gray-800">
        <NavLink to="/profile" end={false} className={navLinkClass}>
          <UserRound className="h-5 w-5" />
          {t('nav.myProfile')}
        </NavLink>
      </nav>
    </aside>
  );
}
