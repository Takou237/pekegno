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

/** C4 : souscription d'un client à un package — commercial et caissier (min), managers ok. */
export function canSubscribePackage(user: User | null): boolean {
  return [...MANAGERS, 'commercial', 'caissier'].includes(role(user));
}

/** K1/K2 : le caissier crée et valide directement les prestations de son périmètre. */
export function canCreatePrestation(user: User | null): boolean {
  return [...MANAGERS, 'commercial', 'caissier'].includes(role(user));
}

export function canEditPrestation(user: User | null): boolean {
  return MANAGERS.includes(role(user));
}

/**
 * D9 : chef d'agence + direction (le super-admin a toutes les permissions).
 * K1/K2 : le caissier valide aussi directement (demande « créer et valider »).
 */
export function canValidatePrestation(user: User | null): boolean {
  return ['super-admin', 'direction-generale', 'responsable-agence', 'caissier'].includes(role(user));
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
