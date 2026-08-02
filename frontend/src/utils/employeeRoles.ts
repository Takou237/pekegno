const ASSIGNABLE_ROLES_BY_ROLE: Record<string, string[]> = {
  'super-admin': [
    'super-admin',
    'direction-generale',
    'commercial',
    'caissier',
    'comptable',
    'formateur',
  ],
  'direction-generale': [
    'direction-generale',
    'commercial',
    'caissier',
    'comptable',
    'formateur',
  ],
  'responsable-agence': ['commercial', 'caissier', 'comptable', 'formateur'],
};

export function assignableRoleNames(currentRoleName: string | null | undefined): string[] {
  return ASSIGNABLE_ROLES_BY_ROLE[currentRoleName ?? ''] ?? [];
}

export const CHIEF_ROLE_NAMES = new Set(['responsable-agence', 'responsable-departement']);
