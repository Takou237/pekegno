import type { User } from '@/types/auth';

export function canManageAcademyPromotions(user: User | null): boolean {
  return [
    'super-admin',
    'direction-generale',
    'responsable-agence',
    'responsable-departement',
  ].includes(user?.role?.name ?? '');
}

export function canCreateCourse(user: User | null): boolean {
  return [
    'super-admin',
    'direction-generale',
    'responsable-agence',
    'responsable-departement',
  ].includes(user?.role?.name ?? '');
}

export function canEnrollLearners(user: User | null): boolean {
  // Le caissier vend et inscrit des apprenants au guichet, comme le commercial.
  return canCreateCourse(user) || ['commercial', 'caissier'].includes(user?.role?.name ?? '');
}