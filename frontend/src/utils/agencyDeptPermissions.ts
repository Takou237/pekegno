import type { User } from '@/types/auth';

/**
 * Droits côté interface du département Agency — miroir des permissions
 * backend (RoleSeeder / migration 2026_10_03_000011). Le backend reste la
 * source de vérité : ces helpers ne servent qu'à masquer les boutons.
 */
const role = (user: User | null) => user?.role?.name ?? '';

const MANAGERS = ['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement'];

export function canManagePackages(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}

export function canCreatePrestation(user: User | null): boolean {
  return [...MANAGERS, 'commercial'].includes(role(user));
}

export function canEditPrestation(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}

/** D9 : chef d'agence + direction (le super-admin a toutes les permissions). */
export function canValidatePrestation(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence'].includes(role(user));
}

export function canManageActions(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}

/** Le community manager fait évoluer le statut / coût / commentaire des actions. */
export function canUpdateActionExecution(user: User | null): boolean {
  return [...MANAGERS, 'community-manager'].includes(role(user));
}

export function canManageTeam(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}

export function canManageContracts(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}
