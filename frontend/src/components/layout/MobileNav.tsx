import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserRound, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getMainItems, navLinkClass, INVOICES_ROLES, type NavItem } from '@/components/layout/navItems';
import { invoicesApi } from '@/api/invoices.api';
import { BrandLogo } from '@/components/common/BrandLogo';

interface MobileNavProps {
  /** Ouverture pilotée par le layout (bouton ☰ du header). */
  isOpen: boolean;
  onClose: () => void;
  contextTitle?: string;
  contextItems?: NavItem[];
  contextOnly?: boolean;
}

export function MobileNav({ isOpen, onClose, contextTitle, contextItems = [], contextOnly = false }: MobileNavProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const location = useLocation();
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
  const fullName =
    [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '—';

  // Fermeture à chaque navigation (clic sur un lien du tiroir).
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[400] lg:hidden">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col overflow-y-auto overscroll-contain border-r border-gray-100 bg-white px-4 py-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-8 flex items-center justify-between px-2">
          <BrandLogo className="h-8" onClick={onClose} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            aria-label={t('common.close')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {contextOnly ? (
          <>
            {contextTitle && (
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {contextTitle}
              </p>
            )}
            <nav className="flex flex-1 flex-col gap-1">
              {contextItems.map(({ to, label, icon: Icon, end, badge, isPathActive }) => (
                <NavLink
                  key={to || '/'}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    navLinkClass({ isActive: isActive && (isPathActive ? isPathActive(location.pathname) : true) })
                  }
                >
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
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-3 dark:bg-gray-800/50">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                {fullName.charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                  {fullName}
                </span>
                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                  {user?.role?.name
                    ? t(`roles.${user.role.name}`, { defaultValue: user.role.name })
                    : t('userMenu.noRole')}
                </span>
              </span>
            </div>

            {contextTitle && contextItems.length > 0 && (
              <>
                <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {contextTitle}
                </p>
                <nav className="mb-4 flex flex-col gap-1 border-b border-gray-100 pb-4 dark:border-gray-800">
                  {contextItems.map(({ to, label, icon: Icon, end, badge, isPathActive }) => (
                    <NavLink
                      key={to || '/'}
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        navLinkClass({ isActive: isActive && (isPathActive ? isPathActive(location.pathname) : true) })
                      }
                    >
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
              </>
            )}

            <nav className="flex flex-1 flex-col gap-1">
              {mainItems.map(({ to, label, icon: Icon, end, badge, isPathActive }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) =>
                    navLinkClass({ isActive: isActive && (isPathActive ? isPathActive(location.pathname) : true) })
                  }
                >
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
          </>
        )}
      </div>
    </div>
  );
}
