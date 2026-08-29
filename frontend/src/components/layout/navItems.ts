import type { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Briefcase,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarDays,
  Contact,
  FileText,
  FolderTree,
  Globe,
  GraduationCap,
  LayoutDashboard,
  Package,
  Receipt,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  UserCheck,
  BookOpen,
  ClipboardList,
  Undo2,
  Warehouse,
  Landmark,
  CircleDollarSign,
  ScrollText,
  Settings,
  Target,
} from 'lucide-react';
import type { DepartmentType } from '@/types/department';

export const ADMIN_ROLES = ['super-admin', 'direction-generale'];

type TranslateFn = ReturnType<typeof useTranslation>['t'];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  badge?: number;
}

function catalogItem(t: TranslateFn): NavItem {
  return { to: '/catalog', label: t('nav.catalog'), icon: Package, end: false };
}

export const INVOICES_ROLES = new Set(['super-admin', 'direction-generale', 'responsable-departement', 'caissier', 'comptable', 'commercial']);

function invoiceItem(t: TranslateFn, badge?: number): NavItem {
  return { to: '/invoices', label: t('nav.invoices'), icon: FileText, end: false, badge };
}

export function getMainItems(t: TranslateFn, roleName: string | null | undefined, agencyId?: string, unpaidBadge?: number): NavItem[] {
  const baseItems: NavItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
  ];

  const commercialItems: NavItem[] = [
    ...baseItems,
    { to: '/commercials', label: t('nav.commercials'), icon: Briefcase, end: false },
    invoiceItem(t, unpaidBadge),
  ];

  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/countries', label: t('nav.geography'), icon: Globe, end: false },
      { to: '/audit', label: t('nav.audit'), icon: FileText, end: false },
    ];
  }

  if (roleName === 'responsable-agence') {
    return [
      ...baseItems,
      { to: '/agencies', label: t('nav.myAgencies'), icon: Building2, end: false },
      { to: '/departments', label: t('nav.departments'), icon: FolderTree, end: false },
      ...(agencyId
        ? [{ to: `/users?agency_id=${agencyId}`, label: t('nav.myTeam'), icon: Users, end: false as const }]
        : []),
      catalogItem(t),
      { to: '/treasury', label: t('nav.treasury'), icon: Landmark, end: false },
      { to: '/expenses', label: t('nav.expenses'), icon: CircleDollarSign, end: false },
      { to: '/commissions/rules', label: t('nav.commissionRules'), icon: ScrollText, end: false },
      { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false },
      { to: '/companies', label: t('nav.companies'), icon: Building2, end: false },
      { to: '/commercials/report', label: t('nav.commercialReport'), icon: BarChart3, end: false },
    ];
  }

  if (roleName === 'responsable-departement') {
    return [
      ...commercialItems,
      { to: '/departments', label: t('nav.myDepartments'), icon: FolderTree, end: false },
      { to: '/users', label: t('nav.myTeam'), icon: Users, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'caissier') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
      invoiceItem(t, unpaidBadge),
      { to: '/expenses', label: t('nav.expenses'), icon: CircleDollarSign, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'comptable') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
      { to: '/commercials', label: t('nav.commercials'), icon: Briefcase, end: false },
      invoiceItem(t, unpaidBadge),
      { to: '/treasury', label: t('nav.treasury'), icon: Landmark, end: false },
      { to: '/expenses', label: t('nav.expenses'), icon: CircleDollarSign, end: false },
      { to: '/commissions/rules', label: t('nav.commissionRules'), icon: ScrollText, end: false },
      { to: '/commissions/entries', label: t('nav.commissionEntries'), icon: ScrollText, end: false },
      { to: '/accounting', label: t('nav.accounting'), icon: Calculator, end: false },
      { to: '/bilans', label: t('nav.bilans'), icon: BarChart3, end: false },
      { to: '/subscriptions', label: t('nav.subscriptions'), icon: CalendarCheck, end: false },
      { to: '/commercials/report', label: t('nav.commercialReport'), icon: BarChart3, end: false },
      { to: '/companies', label: t('nav.companies'), icon: Building2, end: false },
      { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'commercial') {
    return [
      ...baseItems,
      { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false },
      { to: '/companies', label: t('nav.companies'), icon: Building2, end: false },
      invoiceItem(t, unpaidBadge),
      catalogItem(t),
    ];
  }

  return [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    catalogItem(t),
  ];
}

/**
 * Retourne les items de menu latéral pour un département selon son type.
 * Les items pointent vers des routes sous /departments/:departmentId/.
 */
export function getDepartmentItems(t: TranslateFn, type: DepartmentType): NavItem[] {
  switch (type) {
    case 'academy':
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'prospects', label: t('nav.prospects'), icon: Users, end: false },
        { to: 'learners', label: t('nav.learners'), icon: GraduationCap, end: false },
        { to: 'enrollments', label: t('nav.enrollments'), icon: ClipboardList, end: false },
        { to: 'courses', label: t('nav.courses'), icon: BookOpen, end: false },
        { to: 'sessions', label: t('nav.sessions'), icon: CalendarDays, end: false },
        { to: 'planning', label: t('nav.planning'), icon: CalendarCheck, end: false },
        { to: 'trainers', label: t('nav.trainers'), icon: UserCheck, end: false },
        { to: 'presences', label: t('nav.presences'), icon: ClipboardList, end: false },
        { to: 'invoices', label: t('nav.invoices'), icon: Receipt, end: false },
        { to: 'receivables', label: t('nav.receivables'), icon: BarChart3, end: false },
        { to: 'commissions', label: t('nav.commissions'), icon: CircleDollarSign, end: false },
        { to: 'certificates', label: t('nav.certificates'), icon: FileText, end: false },
        { to: 'reports', label: t('nav.reports'), icon: BarChart3, end: false },
        { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
      ];

    case 'agency':
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'prospects', label: t('nav.prospects'), icon: Users, end: false },
        { to: 'clients', label: t('nav.clients'), icon: Contact, end: false },
        { to: 'packages', label: t('nav.packages'), icon: Package, end: false },
        { to: 'contracts', label: t('nav.contracts'), icon: FileText, end: false },
        { to: 'services', label: t('nav.services'), icon: Briefcase, end: false },
        { to: 'community', label: t('nav.communityManagement'), icon: Users, end: false },
        { to: 'advertising', label: t('nav.advertising'), icon: BarChart3, end: false },
        { to: 'renewals', label: t('nav.renewals'), icon: CalendarCheck, end: false },
        { to: 'payments', label: t('nav.invoices'), icon: Receipt, end: false },
        { to: 'receivables', label: t('nav.receivables'), icon: BarChart3, end: false },
        { to: 'reports', label: t('nav.reports'), icon: BarChart3, end: false },
        { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
      ];

    case 'store':
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'catalog', label: t('nav.catalog'), icon: Tags, end: false },
        { to: 'stocks', label: t('nav.stocks'), icon: Warehouse, end: false },
        { to: 'suppliers', label: t('nav.suppliers'), icon: UserCheck, end: false },
        { to: 'purchases', label: t('nav.purchases'), icon: ShoppingCart, end: false },
        { to: 'orders', label: t('nav.orders'), icon: ClipboardList, end: false },
        { to: 'sales', label: t('nav.invoices'), icon: Receipt, end: false },
        { to: 'deliveries', label: t('nav.deliveries'), icon: Truck, end: false },
        { to: 'returns', label: t('nav.returns'), icon: Undo2, end: false },
        { to: 'inventories', label: t('nav.inventories'), icon: Warehouse, end: false },
        { to: 'reports', label: t('nav.reports'), icon: BarChart3, end: false },
        { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
      ];

    case 'studio':
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'prospects', label: t('nav.prospects'), icon: Users, end: false },
        { to: 'clients', label: t('nav.clients'), icon: Contact, end: false },
        { to: 'services', label: t('nav.services'), icon: Briefcase, end: false },
        { to: 'quotes', label: t('nav.quotes'), icon: FileText, end: false },
        { to: 'projects', label: t('nav.projects'), icon: FolderTree, end: false },
        { to: 'planning', label: t('nav.planning'), icon: CalendarDays, end: false },
        { to: 'production', label: t('nav.production'), icon: ClipboardList, end: false },
        { to: 'revisions', label: t('nav.revisions'), icon: Undo2, end: false },
        { to: 'deliveries', label: t('nav.deliveries'), icon: Truck, end: false },
        { to: 'payments', label: t('nav.invoices'), icon: Receipt, end: false },
        { to: 'reports', label: t('nav.reports'), icon: BarChart3, end: false },
        { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
      ];
  }
}

export function navLinkClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'
  }`;
}
