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
  UserRound,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  Undo2,
  Warehouse,
  Landmark,
  Coins,
  CircleDollarSign,
  DollarSign,
  ScrollText,
  Settings,
  Target,
  TrendingUp,
} from 'lucide-react';
import type { DepartmentType } from '@/types/department';
import type { User } from '@/types/auth';
import { canValidateInvoices } from '@/utils/invoicePermissions';
import { homeSpace, isGroupLevelPath } from '@/utils/userScope';

export const ADMIN_ROLES = ['super-admin', 'direction-generale'];

type TranslateFn = ReturnType<typeof useTranslation>['t'];

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  badge?: number;
  /** Renvoie false si le lien ne doit pas être actif pour ce pathname (ex. Factures hors page validations). */
  isPathActive?: (pathname: string) => boolean;
}

function catalogItem(t: TranslateFn): NavItem {
  return { to: '/catalog', label: t('nav.catalog'), icon: Package, end: false };
}

/** Rapport commercial mensuel (Académie + Agency) : commercial = le sien, admin = au choix. */
function monthlyReportItem(t: TranslateFn): NavItem {
  return { to: '/commercials/monthly-report', label: t('nav.monthlyReport'), icon: BarChart3, end: false };
}

/** Suivi des ventes ligne par ligne : commercial = les siennes, admin = toutes. */
function salesTrackingItem(t: TranslateFn): NavItem {
  return { to: '/sales-tracking', label: t('nav.salesTracking'), icon: TrendingUp, end: false };
}

/** Fiche du profil du commercial connecté (CA, ventes, commissions, factures…). */
function myProfileItem(t: TranslateFn): NavItem {
  return { to: '/profile', label: t('nav.myProfile'), icon: UserRound, end: false };
}

export const INVOICES_ROLES = new Set(['super-admin', 'direction-generale', 'responsable-agence', 'responsable-departement', 'comptable']);

// « Factures » ne doit pas rester actif sur la page des validations (/invoices/pending),
// sinon il serait surligné en même temps que « Validations ».
const isInvoiceActive = (pathname: string): boolean =>
  pathname !== '/invoices/pending' &&
  !pathname.startsWith('/invoices/pending/') &&
  pathname !== '/invoices/payment-proofs' &&
  !pathname.startsWith('/invoices/payment-proofs/');

function invoiceItem(t: TranslateFn, badge?: number): NavItem {
  return { to: '/invoices', label: t('nav.invoices'), icon: FileText, end: false, badge, isPathActive: isInvoiceActive };
}

/** File de validation des preuves de règlement du reste à payer (caissier / responsables). */
function paymentProofsItem(t: TranslateFn): NavItem {
  return { to: '/invoices/payment-proofs', label: t('nav.paymentProofs'), icon: Receipt, end: false };
}

/** Suivi personnel : prestations et actions liées au connecté (tous les rôles). */
function trackingItem(t: TranslateFn): NavItem {
  return { to: '/team/tracking', label: t('agencyDept.team.myMissions'), icon: UserCheck, end: true };
}

export function getMainItems(t: TranslateFn, roleName: string | null | undefined, agencyId?: string, unpaidBadge?: number, departmentId?: string): NavItem[] {
  const baseItems: NavItem[] = [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
  ];

  // Chefs : le niveau d'accès commence à leur espace — le premier item y mène
  // directement au lieu du tableau de bord global (qui y redirige de toute façon).
  const chiefHome = (space: 'agency' | 'department'): NavItem[] => {
    if (space === 'agency' && agencyId) {
      return [{ to: `/agencies/${agencyId}`, label: t('nav.myAgency'), icon: Building2, end: false }];
    }
    if (space === 'department' && departmentId) {
      return [{ to: `/departments/${departmentId}`, label: t('nav.myDepartment'), icon: FolderTree, end: false }];
    }
    return [baseItems[0]];
  };

  const commercialItems: NavItem[] = [
    ...baseItems,
    { to: '/commercials', label: t('nav.commercials'), icon: Briefcase, end: false },
    invoiceItem(t, unpaidBadge),
  ];

  if (ADMIN_ROLES.includes(roleName ?? '')) {
    // Super-admin : pas de « Mon suivi » (/team/tracking) dans le menu.
    const tracking = roleName === 'super-admin' ? [] : [trackingItem(t)];
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      ...tracking,
      { to: '/countries', label: t('nav.geography'), icon: Globe, end: false },
      { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
      { to: '/academy', label: t('nav.statAca'), icon: GraduationCap, end: false },
      { to: '/accounting', label: t('nav.accounting'), icon: Calculator, end: false },
      { to: '/bilans', label: t('nav.bilans'), icon: FileText, end: false },
      invoiceItem(t),
      { to: '/contracts', label: t('nav.contracts'), icon: FileText, end: false },
      ...(canValidateInvoices(roleName)
        ? [
            { to: '/invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false },
            paymentProofsItem(t),
          ]
        : []),
      { to: '/invoices/receivables', label: t('nav.receivables'), icon: DollarSign, end: false },
      { to: '/reports/customers', label: t('nav.customersReport'), icon: Users, end: false },
      { to: '/reports/comparison', label: t('nav.comparisonReport'), icon: BarChart3, end: false },
      monthlyReportItem(t),
      salesTrackingItem(t),
      { to: '/audit', label: t('nav.audit'), icon: FileText, end: false },
      // Paramètres du groupe : même page que celle du pays (onglets général,
      // catégories comptabilité/services, utilisateurs, privilèges). La page et
      // sa route /settings existent déjà — l'entrée manquait juste au menu.
      { to: '/settings', label: t('nav.settings'), icon: Settings, end: false },
    ];
  }

  if (roleName === 'responsable-agence') {
    return [
      ...chiefHome('agency'),
      baseItems[1],
      trackingItem(t),
      { to: '/agencies', label: t('nav.myAgencies'), icon: Building2, end: false },
      { to: '/departments', label: t('nav.departments'), icon: FolderTree, end: false },
      ...(agencyId
        ? [{ to: `/users?agency_id=${agencyId}`, label: t('nav.myTeam'), icon: Users, end: false as const }]
        : []),
      catalogItem(t),
      { to: '/invoices/receivables', label: t('nav.receivables'), icon: DollarSign, end: false },
      { to: '/treasury', label: t('nav.treasury'), icon: Landmark, end: false },
      { to: '/expenses', label: t('nav.expenses'), icon: CircleDollarSign, end: false },
      { to: '/commissions/rules', label: t('nav.commissionRules'), icon: ScrollText, end: false },
      { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false },
      { to: '/companies', label: t('nav.companies'), icon: Building2, end: false },
      { to: '/reports/subscriptions', label: t('nav.subscriptionsReport'), icon: CalendarCheck, end: false },
      { to: '/reports/customers', label: t('nav.customersReport'), icon: Users, end: false },
      { to: '/reports/comparison', label: t('nav.comparisonReport'), icon: BarChart3, end: false },
      { to: '/commercials/report', label: t('nav.commercialReport'), icon: BarChart3, end: false },
      monthlyReportItem(t),
    ];
  }

  if (roleName === 'responsable-departement') {
    const [, ...restCommercialItems] = commercialItems;
    return [
      ...chiefHome('department'),
      ...restCommercialItems,
      trackingItem(t),
      { to: '/departments', label: t('nav.myDepartments'), icon: FolderTree, end: false },
      { to: '/users', label: t('nav.myTeam'), icon: Users, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'caissier') {
    return [
      { to: '/caissier/dashboard', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      trackingItem(t),
      { to: '/clients', label: t('nav.clients'), icon: Contact, end: false },
      invoiceItem(t),
      { to: '/invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false },
      { to: '/invoices/payment-proofs', label: t('nav.paymentProofs'), icon: Receipt, end: false },
      { to: '/invoices/receivables', label: t('nav.receivables'), icon: DollarSign, end: false },
      // Comptabilité de son agence : mêmes actions que l'admin (le backend
      // restreint déjà au périmètre des agences du caissier).
      { to: '/accounting', label: t('nav.accounting'), icon: Calculator, end: false },
      { to: '/caissier/commissions', label: t('nav.commissions'), icon: Coins, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'comptable') {
    return [
      { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      trackingItem(t),
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
      { to: '/reports/subscriptions', label: t('nav.subscriptionsReport'), icon: CalendarCheck, end: false },
      { to: '/reports/customers', label: t('nav.customersReport'), icon: Users, end: false },
      { to: '/reports/comparison', label: t('nav.comparisonReport'), icon: BarChart3, end: false },
      { to: '/commercials/report', label: t('nav.commercialReport'), icon: BarChart3, end: false },
      monthlyReportItem(t),
      { to: '/companies', label: t('nav.companies'), icon: Building2, end: false },
      { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false },
      catalogItem(t),
    ];
  }

  if (roleName === 'commercial') {
    return [
      ...baseItems,
      trackingItem(t),
      { to: '/prospects', label: t('nav.prospects'), icon: Target, end: false },
      // Commercial : menu Factures SANS pastille rouge (pas de badge impayés).
      invoiceItem(t),
      { to: '/commercial/commissions', label: t('nav.commissions'), icon: Coins, end: false },
      monthlyReportItem(t),
      salesTrackingItem(t),
      catalogItem(t),
      myProfileItem(t),
    ];
  }

  if (roleName === 'formateur') {
    // Espace formateur : uniquement ses formations, ses apprenants, ses
    // sessions et son planning (pas de Pays/Agence/Département).
    return [
      { to: '/formateur', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
      { to: '/formateur/formations', label: t('nav.courses'), icon: BookOpen, end: false },
      { to: '/formateur/apprenants', label: t('nav.learners'), icon: UserCheck, end: false },
      { to: '/formateur/sessions', label: t('nav.sessions'), icon: CalendarDays, end: false },
      { to: '/formateur/planning', label: t('nav.planning'), icon: CalendarCheck, end: false },
    ];
  }

  if (roleName === 'community-manager') {
    return [
      trackingItem(t),
    ];
  }

  return [
    { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
    trackingItem(t),
    catalogItem(t),
  ];
}

/** Rôles livrés avec une interface dédiée ; tout autre rôle est « personnalisé ». */
export const BUILT_IN_ROLES = new Set([
  'super-admin',
  'direction-generale',
  'responsable-agence',
  'responsable-departement',
  'caissier',
  'comptable',
  'commercial',
  'formateur',
  'community-manager',
  'client',
]);

export function isCustomRole(roleName: string | null | undefined): boolean {
  return Boolean(roleName) && !BUILT_IN_ROLES.has(roleName as string);
}

/**
 * Menu d'un rôle personnalisé, construit à partir de ses privilèges : chaque
 * entrée n'apparaît que si le rôle a la permission qui ouvre la page. Ainsi un
 * rôle créé depuis « Rôles & permissions » ne voit que ce qu'il peut ouvrir,
 * au lieu d'une interface générique qui répond « accès non autorisé ».
 */
export function getPermissionItems(t: TranslateFn, permissions: string[]): NavItem[] {
  const has = (...names: string[]) => names.some((name) => permissions.includes(name));

  const items: Array<[boolean, NavItem]> = [
    [has('stats.consulter'), { to: '/', label: t('nav.dashboard'), icon: LayoutDashboard, end: true }],
    [true, trackingItem(t)],
    [has('countries.consulter'), { to: '/countries', label: t('nav.geography'), icon: Globe, end: false }],
    [has('agencies.consulter'), { to: '/agencies', label: t('nav.agencies'), icon: Building2, end: false }],
    [has('departments.consulter'), { to: '/departments', label: t('nav.departments'), icon: FolderTree, end: false }],
    [has('clients.consulter'), { to: '/clients', label: t('nav.clients'), icon: Contact, end: false }],
    [has('prospects.consulter'), { to: '/prospects', label: t('nav.prospects'), icon: Target, end: false }],
    [has('commercials.consulter'), { to: '/commercials', label: t('nav.commercials'), icon: Briefcase, end: false }],
    [has('employes.consulter'), { to: '/employees', label: t('nav.employees'), icon: UserCheck, end: false }],
    [has('users.consulter'), { to: '/users', label: t('nav.users'), icon: Users, end: false }],
    [has('invoices.consulter'), invoiceItem(t)],
    // Validation des factures : réservée au super-admin, au directeur général et
    // au caissier (jamais à un rôle personnalisé).
    [has('invoices.consulter', 'invoices.encaisser'), { to: '/invoices/receivables', label: t('nav.receivables'), icon: DollarSign, end: false }],
    [has('contrats.consulter'), { to: '/contracts', label: t('nav.contracts'), icon: FileText, end: false }],
    [has('abonnements.consulter'), { to: '/subscriptions', label: t('nav.subscriptions'), icon: CalendarCheck, end: false }],
    [has('comptabilite.consulter'), { to: '/accounting', label: t('nav.accounting'), icon: Calculator, end: false }],
    [has('bilans.consulter'), { to: '/bilans', label: t('nav.bilans'), icon: BarChart3, end: false }],
    [has('tresories.consulter'), { to: '/treasury', label: t('nav.treasury'), icon: Landmark, end: false }],
    [has('depenses.consulter'), { to: '/expenses', label: t('nav.expenses'), icon: CircleDollarSign, end: false }],
    [has('commissions.consulter'), { to: '/commissions/entries', label: t('nav.commissionEntries'), icon: Coins, end: false }],
    [has('entreprises.consulter'), { to: '/companies', label: t('nav.companies'), icon: Building2, end: false }],
    [has('opportunites.consulter'), { to: '/opportunities', label: t('nav.opportunities'), icon: Target, end: false }],
    [has('courses.consulter', 'sessions.consulter'), { to: '/academy', label: t('nav.statAca'), icon: GraduationCap, end: false }],
    [has('reports.consulter'), { to: '/reports/customers', label: t('nav.customersReport'), icon: Users, end: false }],
    [has('reports.consulter'), { to: '/reports/comparison', label: t('nav.comparisonReport'), icon: BarChart3, end: false }],
    [has('reports.consulter', 'abonnements.consulter'), { to: '/reports/subscriptions', label: t('nav.subscriptionsReport'), icon: CalendarCheck, end: false }],
    [has('commercials.reporting'), { to: '/commercials/report', label: t('nav.commercialReport'), icon: BarChart3, end: false }],
    [has('commercials.reporting'), monthlyReportItem(t)],
    [has('services.consulter', 'products.consulter'), catalogItem(t)],
    [has('activity-logs.consulter'), { to: '/audit', label: t('nav.audit'), icon: ScrollText, end: false }],
    [has('settings.modifier', 'roles.consulter'), { to: '/settings', label: t('nav.settings'), icon: Settings, end: false }],
  ];

  return items.filter(([allowed]) => allowed).map(([, item]) => item);
}

/**
 * Menu principal de l'utilisateur connecté :
 * - rôle personnalisé → menu construit depuis ses permissions ;
 * - rôle livré → menu dédié ;
 * - rôle à espace (chefs, directeur général d'un pays) → sans les pages de
 *   niveau groupe, qui les renverraient de toute façon vers leur espace.
 */
export function getUserMainItems(t: TranslateFn, user: User | null | undefined, unpaidBadge?: number): NavItem[] {
  const roleName = user?.role?.name;
  const agencyAssignment = user?.assignments?.find((a) => a.pivot?.is_primary === true);
  const deptChiefAssignment = user?.assignments?.find((a) => a.pivot?.is_department_chief === true);

  const items = isCustomRole(roleName)
    ? getPermissionItems(t, user?.permissions ?? [])
    : getMainItems(t, roleName, agencyAssignment?.id, unpaidBadge, deptChiefAssignment?.pivot?.department_id ?? undefined);

  const space = homeSpace(user);
  if (!space) return items;

  const scoped = items.filter((item) => !isGroupLevelPath(item.to.split('?')[0]));
  // Directeur général : son pays remplace le tableau de bord groupe.
  if (space.type === 'country') {
    return [
      { to: space.path, label: t('nav.myCountry'), icon: Globe, end: false },
      ...scoped.filter((item) => item.to !== '/'),
    ];
  }
  return scoped;
}

/**
 * Retourne les items de menu latéral pour un département selon son type.
 * Les items pointent vers des routes sous /departments/:departmentId/.
 */
export function getDepartmentItems(t: TranslateFn, type: DepartmentType, roleName?: string | null): NavItem[] {
  // L'équipier (community-manager) qui entre depuis Mon suivi ne voit que son
  // périmètre de travail : prestations, suivi des actions, équipe.
  if (roleName === 'community-manager' && type === 'agency') {
    return [
      { to: 'prestations', label: t('nav.prestations'), icon: Briefcase, end: false },
      { to: 'actions', label: t('nav.actionsBoard'), icon: ClipboardCheck, end: false },
      { to: 'client-team', label: t('nav.clientTeam'), icon: UserCheck, end: false },
    ];
  }

  switch (type) {
    case 'academy':
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'prospects', label: t('nav.prospects'), icon: Users, end: false },
        { to: 'learners', label: t('nav.learners'), icon: UserCheck, end: false },
        { to: 'products', label: t('nav.services'), icon: Package, end: false },
        { to: 'courses', label: t('nav.courses'), icon: BookOpen, end: false },
        { to: 'sessions', label: t('nav.sessions'), icon: CalendarDays, end: false },
        { to: 'planning', label: t('nav.planning'), icon: CalendarCheck, end: false },
        { to: 'trainers', label: t('nav.trainers'), icon: UserCheck, end: false },
        { to: 'invoices', label: t('nav.invoices'), icon: Receipt, end: false },
        ...(canValidateInvoices(roleName)
          ? [{ to: 'invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false }]
          : []),
        { to: 'receivables', label: t('nav.receivables'), icon: BarChart3, end: false },
        { to: 'certificates', label: t('nav.certificates'), icon: FileText, end: false },
        { to: 'reports', label: t('nav.reports'), icon: BarChart3, end: false },
        { to: 'accounting', label: t('nav.accounting'), icon: Calculator, end: false },
        { to: 'bilans', label: t('nav.bilans'), icon: BarChart3, end: false },
        { to: 'settings', label: t('nav.settings'), icon: Settings, end: false },
      ];

    case 'agency':
      // Academy retiré du menu Agency (réunion). Voir doc/AGENCY_A_FAIRE.md §1.
      return [
        { to: '', label: t('nav.dashboard'), icon: LayoutDashboard, end: true },
        { to: 'prospects', label: t('nav.prospects'), icon: Users, end: false },
        { to: 'clients', label: t('nav.clients'), icon: Contact, end: false },
        { to: 'packages', label: t('nav.packages'), icon: Package, end: false },
        // Onglet « Suivi des prestations » retiré : la page Prestations suffit (route /prestations/tracking encore accessible).
        { to: 'prestations', label: t('nav.prestations'), icon: Briefcase, end: false },
        { to: 'client-team', label: t('nav.clientTeam'), icon: UserCheck, end: false },
        { to: 'contracts', label: t('nav.contracts'), icon: FileText, end: false },
        { to: 'services', label: t('nav.services'), icon: Tags, end: false },
        { to: 'actions', label: t('nav.actionsBoard'), icon: ClipboardList, end: false },
        { to: 'renewals', label: t('nav.renewals'), icon: CalendarCheck, end: false },
        { to: 'invoices', label: t('nav.invoices'), icon: Receipt, end: false },
        ...(canValidateInvoices(roleName)
          ? [{ to: 'invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false }]
          : []),
        { to: 'receivables', label: t('nav.receivables'), icon: BarChart3, end: false },
        { to: 'accounting', label: t('nav.accounting'), icon: Calculator, end: false },
        { to: 'bilans', label: t('nav.bilans'), icon: BarChart3, end: false },
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
        ...(canValidateInvoices(roleName)
          ? [{ to: 'invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false }]
          : []),
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
        ...(canValidateInvoices(roleName)
          ? [{ to: 'invoices/pending', label: t('nav.pendingInvoices'), icon: ClipboardCheck, end: false }]
          : []),
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
