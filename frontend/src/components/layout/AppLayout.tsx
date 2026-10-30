import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { homeSpace, isGroupLevelPath } from '@/utils/userScope';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ContextBar } from './ContextBar';
import { forgetSpaceNav, getSpaceNav } from './spaceNavMemory';
import { getDepartmentItems, type NavItem } from './navItems';
import { getCountryItems } from '@/components/countries/CountryLayout';
import { getAgencyItems } from '@/components/agencies/AgencyLayout';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const isProfilePage = pathname.startsWith('/profile');

  // Une page globale (hors Profil) quitte l'espace : on l'oublie.
  useEffect(() => {
    if (!isProfilePage) forgetSpaceNav();
  }, [isProfilePage]);

  // Profil / Paramètres ouverts depuis un espace pays, agence ou département :
  // le tiroir mobile garde le menu de cet espace au lieu du menu principal,
  // y compris après une actualisation de la page.
  const spaceNav = useMemo(() => {
    const ref = isProfilePage ? getSpaceNav(user?.id) : null;
    if (!ref) return null;
    const roleName = user?.role?.name;
    const items: NavItem[] =
      ref.kind === 'country'
        ? getCountryItems(t, roleName)
        : ref.kind === 'agency'
          ? getAgencyItems(t, ref.agencyType, roleName)
          : getDepartmentItems(t, ref.departmentType, roleName);
    return {
      title: ref.title,
      items: items.map((item) => ({ ...item, to: item.to ? `${ref.basePath}/${item.to}` : ref.basePath })),
    };
  }, [isProfilePage, user?.id, user?.role?.name, t]);

  // Chefs et directeur général : leur accès commence à leur espace ; les
  // pages de niveau groupe les y renvoient.
  const space = homeSpace(user);
  if (space && isGroupLevelPath(pathname)) {
    return <Navigate to={space.path} replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-950">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <ContextBar onMobileMenuToggle={() => setMobileOpen((v) => !v)} />
        <main className="min-w-0 flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      <MobileNav
        isOpen={mobileOpen}
        onClose={closeMobileNav}
        contextTitle={spaceNav?.title}
        contextItems={spaceNav?.items}
        contextOnly={Boolean(spaceNav)}
      />
    </div>
  );
}
