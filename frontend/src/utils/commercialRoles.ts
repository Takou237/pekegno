/**
 * Rôles qui disposent des fonctionnalités du commercial (ventes, factures,
 * prospects, rapport…). Le community-manager les cumule avec le suivi de ses
 * prestations. Miroir de `User::COMMERCIAL_ROLES` côté API.
 */
export const COMMERCIAL_ROLES = ['commercial', 'community-manager'];

export function actsAsCommercial(roleName: string | null | undefined): boolean {
  return COMMERCIAL_ROLES.includes(roleName ?? '');
}
