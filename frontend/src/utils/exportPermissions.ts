import type { User } from '@/types/auth';

export function canExportData(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    user?.role?.name ?? ''
  );
}
