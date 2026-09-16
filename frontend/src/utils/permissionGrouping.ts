import type { useTranslation } from 'react-i18next';
import type { Permission } from '@/types/user';

type TranslateFn = ReturnType<typeof useTranslation>['t'];

// Le backend nomme chaque permission "entite.action" (ex: invoices.valider).
// On regroupe par préfixe pour éviter une matrice à ~150 colonnes illisible.
const ACTION_LABEL_KEYS: Record<string, string> = {
  creer: 'privileges.permissionCreate',
  modifier: 'privileges.permissionEdit',
  supprimer: 'privileges.permissionDelete',
  exporter: 'privileges.permissionExport',
  consulter: 'privileges.permissionView',
  imprimer: 'privileges.permissionPrint',
  valider: 'privileges.permissionValidate',
  encaisser: 'privileges.permissionCash',
  annuler: 'privileges.permissionCancel',
  reporting: 'privileges.permissionReporting',
  renouveler: 'privileges.permissionRenew',
};

export function permissionDomain(permission: Pick<Permission, 'name'>): string {
  const idx = permission.name.indexOf('.');
  return idx === -1 ? 'other' : permission.name.slice(0, idx);
}

function permissionAction(permission: Pick<Permission, 'name'>): string {
  const idx = permission.name.indexOf('.');
  return idx === -1 ? permission.name : permission.name.slice(idx + 1);
}

export function domainLabel(t: TranslateFn, domain: string): string {
  return t(`privileges.domains.${domain}`, { defaultValue: domain });
}

export function actionLabel(t: TranslateFn, permission: Permission): string {
  const action = permissionAction(permission);
  const key = ACTION_LABEL_KEYS[action];
  return key ? t(key, { defaultValue: permission.label || action }) : permission.label || action;
}

export interface PermissionGroup {
  domain: string;
  permissions: Permission[];
}

export function groupPermissions(t: TranslateFn, permissions: Permission[]): PermissionGroup[] {
  const map = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const domain = permissionDomain(permission);
    const list = map.get(domain);
    if (list) list.push(permission);
    else map.set(domain, [permission]);
  }
  return Array.from(map.entries())
    .map(([domain, list]) => ({ domain, permissions: list }))
    .sort((a, b) => domainLabel(t, a.domain).localeCompare(domainLabel(t, b.domain), 'fr'));
}

export function permissionMatchesQuery(permission: Permission, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    permission.name.toLowerCase().includes(q) ||
    (permission.label ?? '').toLowerCase().includes(q) ||
    (permission.description ?? '').toLowerCase().includes(q)
  );
}
