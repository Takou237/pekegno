import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BookOpen, CalendarCheck, CalendarDays, LayoutDashboard, UserCheck } from 'lucide-react';
import { TrainerLayout } from './TrainerLayout';

/**
 * « Mes formations » : espace formateur d'un compte non formateur (commercial,
 * community manager…) lié à un profil formateur. Mêmes pages que l'espace
 * formateur, présentées en onglets sous une seule entrée de menu.
 */
export default function MyTrainingsLayout() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/mes-formations', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/mes-formations/formations', label: t('nav.courses'), icon: BookOpen, end: false },
    { to: '/mes-formations/apprenants', label: t('nav.learners'), icon: UserCheck, end: false },
    { to: '/mes-formations/sessions', label: t('nav.sessions'), icon: CalendarDays, end: false },
    { to: '/mes-formations/planning', label: t('nav.planning'), icon: CalendarCheck, end: false },
    { to: '/mes-formations/presences', label: t('nav.presences'), icon: CalendarCheck, end: false },
  ];

  return (
    <div className="flex flex-col gap-6">
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-gray-200 px-1 dark:border-gray-800">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
      <TrainerLayout />
    </div>
  );
}
