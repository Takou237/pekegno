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
  return canCreateCourse(user) || user?.role?.name === 'commercial';
}