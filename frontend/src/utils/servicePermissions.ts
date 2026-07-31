import type { User } from '@/types/auth';

/** Reflète app/Policies/ServicePolicy.php (Dev1). */
export function canViewServices(user: User | null): boolean {
  return Boolean(user);
}

export function canCreateService(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );
}

/** Approximation : le backend vérifie en plus l'assignation primaire (responsable-agence). */
export function canEditService(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );
}

export function canDeleteService(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'].includes(
    user?.role?.name ?? ''
  );
}

export function canManageServiceTrash(user: User | null): boolean {
  return user?.role?.name === 'super-admin';
}
