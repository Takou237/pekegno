import type { User } from '@/types/auth';

/**
 * Espace d'entrée d'un rôle « à périmètre » : son accès commence (et reste)
 * à ce niveau de l'organisation.
 * - chef d'agence → son agence ;
 * - chef de département → son département ;
 * - directeur général rattaché à un pays → ce pays.
 */
export type HomeSpace =
  | { type: 'agency'; id: string; path: string }
  | { type: 'department'; id: string; path: string }
  | { type: 'country'; id: string; path: string };

export const CHIEF_ROLES = ['responsable-agence', 'responsable-departement'];

export function isChief(user: User | null | undefined): boolean {
  return CHIEF_ROLES.includes(user?.role?.name ?? '');
}

export function homeSpace(user: User | null | undefined): HomeSpace | null {
  const role = user?.role?.name;

  if (role === 'responsable-agence') {
    const chiefOf = user?.assignments?.find((a) => a.pivot?.is_primary === true);
    // /agencies/:id résout le pays puis redirige vers l'URL imbriquée.
    return chiefOf ? { type: 'agency', id: chiefOf.id, path: `/agencies/${chiefOf.id}` } : null;
  }

  if (role === 'responsable-departement') {
    const departmentId = user?.assignments?.find((a) => a.pivot?.is_department_chief === true)?.pivot?.department_id;
    return departmentId ? { type: 'department', id: departmentId, path: `/departments/${departmentId}` } : null;
  }

  if (role === 'direction-generale' && user?.country_id) {
    return { type: 'country', id: user.country_id, path: `/countries/${user.country_id}` };
  }

  return null;
}

/** Agence du chef d'agence (pour vérifier qu'un département lui appartient). */
export function chiefAgencyId(user: User | null | undefined): string | null {
  const space = homeSpace(user);
  return space?.type === 'agency' ? space.id : null;
}

/**
 * Pages « groupe » hors du périmètre d'un rôle à espace (listes de pays,
 * d'agences, de départements, tableaux de bord et réglages du groupe) :
 * on renvoie l'utilisateur vers son espace.
 */
const GROUP_LEVEL_PATHS = [
  '/countries',
  '/agencies',
  '/agencies/trash',
  '/departments',
  '/departments/trash',
  '/academy',
  '/audit',
  '/settings',
  '/privileges',
];

export function isGroupLevelPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return GROUP_LEVEL_PATHS.includes(path);
}
