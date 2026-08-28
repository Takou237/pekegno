import type { User } from '@/types/auth';

export function canManageAcademyPromotions(user: User | null): boolean {
  return [
    'super-admin',
    'direction-generale',
    'responsable-agence',
    'responsable-departement',
  ].includes(user?.role?.name ?? '');
}