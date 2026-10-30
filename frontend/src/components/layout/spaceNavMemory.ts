import type { NavItem } from './navItems';

/**
 * Dernier menu d'espace (agence / département) affiché dans le tiroir mobile.
 * Les pages Profil / Paramètres sont rendues hors de ces layouts : on y
 * réutilise ce menu pour que le tiroir ne change pas complètement.
 */
interface SpaceNav {
  userId: string;
  title?: string;
  items: NavItem[];
}

let lastSpaceNav: SpaceNav | null = null;

/** Mémorise le menu d'un espace ; `basePath` rend les liens relatifs absolus. */
export function rememberSpaceNav(userId: string, basePath: string, title: string | undefined, items: NavItem[]) {
  const base = basePath.replace(/\/$/, '');
  lastSpaceNav = {
    userId,
    title,
    items: items.map((item) => ({ ...item, to: item.to ? `${base}/${item.to}` : base })),
  };
}

export function getSpaceNav(userId: string | undefined): SpaceNav | null {
  return lastSpaceNav && lastSpaceNav.userId === userId ? lastSpaceNav : null;
}
