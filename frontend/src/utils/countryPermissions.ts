import type { User } from '@/types/auth';

export function canCreateCountry(user: User | null): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '');
}
