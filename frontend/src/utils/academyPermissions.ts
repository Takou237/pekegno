import type { User } from '@/types/auth';

export function canManageAcademyPromotions(user: User | null): boolean {
  return [
    'super-admin',
    'direction-generale', 'directeur',
    'responsable-agence',
    'responsable-departement',
  ].includes(user?.role?.name ?? '');
}

export function canCreateCourse(user: User | null): boolean {
  return [
    'super-admin',
    'direction-generale', 'directeur',
    'responsable-agence',
    'responsable-departement',
  ].includes(user?.role?.name ?? '');
}

export function canEnrollLearners(user: User | null): boolean {
  // Le caissier vend et inscrit des apprenants au guichet, comme le commercial.
  return canCreateCourse(user) || ['commercial', 'community-manager', 'caissier'].includes(user?.role?.name ?? '');
}
/** Droit réel du rôle (renvoyé par l'API avec l'utilisateur connecté). */
function hasPermission(user: User | null, permission: string): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '') || Boolean(user?.permissions?.includes(permission));
}

export function canEditSessions(user: User | null): boolean {
  return hasPermission(user, 'sessions.modifier');
}

export function canDeleteSessions(user: User | null): boolean {
  return hasPermission(user, 'sessions.supprimer');
}
