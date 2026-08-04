import type { User } from '@/types/auth';

const MANAGERS = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'];
const ALL_EMPLOYEES = [
  'super-admin',
  'direction-generale',
  'responsable-agence',
  'responsable-departement',
  'commercial',
  'caissier',
  'comptable',
  'formateur',
];

export function canViewCatalog(user: User | null): boolean {
  return ALL_EMPLOYEES.includes(user?.role?.name ?? '');
}

export function canCreateService(user: User | null): boolean {
  return MANAGERS.includes(user?.role?.name ?? '');
}

export function canEditService(user: User | null): boolean {
  return MANAGERS.includes(user?.role?.name ?? '');
}

export function canDeleteService(user: User | null): boolean {
  return ['super-admin', 'direction-generale'].includes(user?.role?.name ?? '');
}

export function canManageCatalogTrash(user: User | null): boolean {
  return user?.role?.name === 'super-admin';
}
