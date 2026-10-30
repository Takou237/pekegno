import type { Agency } from '@/types/agency';
import type { DepartmentType } from '@/types/department';

/**
 * Dernier espace (pays / agence / département) affiché avant d'ouvrir les
 * pages Profil / Paramètres, rendues hors de ces layouts : le tiroir mobile y
 * reprend le menu de cet espace.
 *
 * Conservé en sessionStorage (et non en mémoire) pour survivre à une
 * actualisation de la page. Les icônes ne se sérialisent pas : on garde le
 * type d'espace et le menu est reconstruit par AppLayout.
 */
export type SpaceNavRef =
  | { userId: string; kind: 'country'; basePath: string; title?: string }
  | { userId: string; kind: 'agency'; basePath: string; title?: string; agencyType?: Agency['type'] }
  | { userId: string; kind: 'department'; basePath: string; title?: string; departmentType: DepartmentType };

const STORAGE_KEY = 'pekegno.spaceNav';

export function rememberSpaceNav(ref: SpaceNavRef) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...ref, basePath: ref.basePath.replace(/\/$/, '') }));
  } catch {
    // Stockage indisponible (navigation privée…) : menu principal par défaut.
  }
}

export function forgetSpaceNav() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Rien à oublier.
  }
}

export function getSpaceNav(userId: string | undefined): SpaceNavRef | null {
  if (!userId) return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const ref = raw ? (JSON.parse(raw) as SpaceNavRef) : null;
    return ref && ref.userId === userId ? ref : null;
  } catch {
    return null;
  }
}
