import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Building2, UserRound } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/agencies', label: 'Agences', icon: Building2, end: false },
  { to: '/profile', label: 'Mon profil', icon: UserRound, end: false },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-gray-100 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900 lg:block">
      <div className="mb-8 px-2">
        <span className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">
          PEKEGNO
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
