const ASSIGNABLE_ROLES_BY_ROLE: Record<string, string[]> = {
  'super-admin': [
    'super-admin',
    'direction-generale',
    'directeur',
    'commercial',
    'caissier',
    'comptable',
    'formateur',
  ],
  // Le directeur général crée un autre directeur général ou un directeur, jamais un super-admin.
  'direction-generale': [
    'direction-generale',
    'directeur',
    'commercial',
    'caissier',
    'comptable',
    'formateur',
  ],
  // Directeur (ancien directeur général rattaché à un pays).
  directeur: ['directeur', 'commercial', 'caissier', 'comptable', 'formateur'],
  'responsable-agence': ['commercial', 'caissier', 'comptable', 'formateur'],
  'responsable-departement': ['commercial', 'caissier', 'comptable', 'formateur'],
};

export function assignableRoleNames(currentRoleName: string | null | undefined): string[] {
  return ASSIGNABLE_ROLES_BY_ROLE[currentRoleName ?? ''] ?? [];
}

export const CHIEF_ROLE_NAMES = new Set(['responsable-agence', 'responsable-departement']);

const CREATOR_ROLES = new Set(['super-admin', 'direction-generale', 'directeur', 'responsable-agence', 'responsable-departement']);

/**
 * Un rôle personnalisé (créé depuis « Rôles & Permissions ») peut être
 * attribué depuis le formulaire utilisateur par tout créateur de compte,
 * sans escalade. Le rôle `client` et les rôles de chef restent exclus
 * (inscription publique / flux chefs dédiés).
 */
export function isRoleAssignableToForm(
  roleName: string,
  currentRoleName: string | null | undefined,
): boolean {
  if (roleName === 'client') return false;
  if (CHIEF_ROLE_NAMES.has(roleName)) return false;
  if (assignableRoleNames(currentRoleName).includes(roleName)) return true;
  if (!CREATOR_ROLES.has(currentRoleName ?? '')) return false;
  if (roleName === 'super-admin' || roleName === 'direction-generale' || roleName === 'directeur') return false;
  return true;
}
