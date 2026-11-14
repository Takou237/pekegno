import type { User } from '@/types/auth';

export function canViewDepartments(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'directeur', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );
}

export function canCreateDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'directeur', 'responsable-agence'].includes(
    user?.role?.name ?? ''
  );
}

/** Le backend restreint au périmètre : RA = agences primaires, RD = ses départements. */
export function canEditDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'directeur', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );
}

export function canDeleteDepartment(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'directeur'].includes(user?.role?.name ?? '');
}

export function canManageDepartmentTrash(user: User | null): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '');
}
