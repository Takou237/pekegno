import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getMainItems, navLinkClass, INVOICES_ROLES } from '@/components/layout/navItems';
import { invoicesApi } from '@/api/invoices.api';

export function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [unpaidBadge, setUnpaidBadge] = useState<number>(0);
  const agencyAssignment = user?.assignments?.find((a: any) => a.pivot?.is_primary === true);
  const roleName = user?.role?.name;

  useEffect(() => {
    if (!roleName || !INVOICES_ROLES.has(roleName)) return;
    let cancelled = false;
    invoicesApi.list({ status: 'unpaid', per_page: 1 }).then((res) => {
      if (!cancelled) setUnpaidBadge(res.invoices.meta.total);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [roleName]);

  const mainItems = getMainItems(t, roleName, agencyAssignment?.id, unpaidBadge);

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-6 dark:border-gray-800 dark:bg-gray-900 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto">
      <div className="mb-8 px-2">
        <span className="text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-400">
          PEKEGNO
        </span>
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {mainItems.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <Icon className="h-5 w-5" />
            {label}
            {badge != null && badge > 0 && (
              <span
                className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                aria-label={t('nav.unpaidBadge', { count: badge })}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
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
