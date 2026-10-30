import { useCallback, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { homeSpace, isGroupLevelPath } from '@/utils/userScope';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { ContextBar } from './ContextBar';
import { getSpaceNav } from './spaceNavMemory';

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileNav = useCallback(() => setMobileOpen(false), []);
  const { user } = useAuth();
  const { pathname } = useLocation();

  // Chefs et directeur général : leur accès commence à leur espace ; les
  // pages de niveau groupe les y renvoient.
  const space = homeSpace(user);
  if (space && isGroupLevelPath(pathname)) {
    return <Navigate to={space.path} replace />;
  }

  // Profil / Paramètres ouverts depuis un espace agence ou département : le
  // tiroir mobile garde le menu de cet espace au lieu du menu principal.
  const spaceNav = pathname.startsWith('/profile') ? getSpaceNav(user?.id) : null;

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
