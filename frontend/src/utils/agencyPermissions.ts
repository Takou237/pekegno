import type { User } from '@/types/auth';

/**
 * Reflète app/Policies/AgencyPolicy.php (Dev1) pour éviter d'afficher des
 * actions vouées à un 403. La vérité finale reste côté backend : en cas
 * d'écart (ex. assignation "responsable-agence" non chargée côté front), le
 * 403 est de toute façon intercepté globalement (voir api/client.ts) et
 * affiché en toast.
 */
export function canViewAgencies(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    user?.role?.name ?? ''
  );
}

export function canCreateAgency(user: User | null): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '');
}

/** Approximation : le backend vérifie en plus l'assignation "responsable-agence" primaire. */
export function canEditAgency(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    user?.role?.name ?? ''
  );
}

export function canDeleteAgency(user: User | null): boolean {
  return user?.role?.name === 'super-admin';
}

export function canManageTrash(user: User | null): boolean {
  return user?.role?.name === 'super-admin';
}
