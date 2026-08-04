import type { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  FolderTree,
  LayoutDashboard,
  Package,
  Shield,
  Users,
} from 'lucide-react';

export const ADMIN_ROLES = ['super-admin', 'direction-generale'];

type TranslateFn = ReturnType<typeof useTranslation>['t'];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
}

function catalogItem(t: TranslateFn): NavItem {
  return { to: '/catalog', label: t('nav.catalog'), icon: Package, end: false };
}

export function getMainItems(t: TranslateFn, roleName: string | null | undefined, agencyId?: string): NavItem[] {
  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/agencies', label: t('nav.agencies'), icon: Building2, end: false },
      { to: '/users', label: t('nav.users'), icon: Users, end: false },
      { to: '/privileges', label: t('nav.privileges'), icon: Shield, end: false },
    ];
  }

  if (roleName === 'responsable-agence') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/agencies', label: t('nav.myAgencies'), icon: Building2, end: false },
      { to: '/departments', label: t('nav.departments'), icon: FolderTree, end: false },
      ...(agencyId
        ? [{ to: `/users?agency_id=${agencyId}`, label: t('nav.myTeam'), icon: Users, end: false as const }]
        : []),
      catalogItem(t),
    ];
  }

  if (roleName === 'responsable-departement') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/departments', label: t('nav.myDepartments'), icon: FolderTree, end: false },
      { to: '/users', label: t('nav.myTeam'), icon: Users, end: false },
      catalogItem(t),
    ];
  }

  return [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    catalogItem(t),
  ];
}

export function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;
}
