import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface SubNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

interface SubNavProps {
  items: SubNavItem[];
  linkClass: (state: { isActive: boolean }) => string;
}

/**
 * Sous-menu d'un espace (pays, agence, département) :
 * colonne verticale à partir de lg, barre d'onglets défilante en dessous
 * (sinon les sous-sections sont inaccessibles sur téléphone/tablette).
 */
export function SubNav({ items, linkClass }: SubNavProps) {
  const navRef = useRef<HTMLElement>(null);
  const location = useLocation();

  // Garde l'onglet actif visible dans la barre défilante.
  useEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [location.pathname]);

  return (
    <nav
      ref={navRef}
      className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-y border-gray-100 bg-white px-2 py-2 sm:mx-0 sm:rounded-2xl sm:border lg:flex-col lg:overflow-visible lg:p-3 dark:border-gray-800 dark:bg-gray-900"
    >
      {items.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to || '/'}
          to={to}
          end={end}
          className={(state) => `${linkClass(state)} shrink-0 whitespace-nowrap`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
