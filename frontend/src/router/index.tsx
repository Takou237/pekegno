import { Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { HomeRedirect } from '@/router/HomeRedirect';
import { AppLayout } from '@/components/layout/AppLayout';
import { AgencyLayout } from '@/components/agencies/AgencyLayout';
import { AgencyRedirect } from '@/components/agencies/AgencyRedirect';
import { CountryLayout } from '@/components/countries/CountryLayout';
import { DepartmentLayout } from '@/components/departments/DepartmentLayout';
import { ByDepartmentType } from '@/components/departments/ByDepartmentType';
import {
  PageSkeleton,
  SkeletonCards,
  SkeletonDashboard,
  SkeletonDetail,
  SkeletonForm,
  SkeletonTable,
} from '@/components/ui/Skeleton';
import RouteErrorPage from '@/pages/RouteErrorPage';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

const LoginPage = lazyWithRetry(() => import('@/pages/auth/LoginPage'));
const TwoFactorPage = lazyWithRetry(() => import('@/pages/auth/TwoFactorPage'));
const ForgotPasswordPage = lazyWithRetry(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazyWithRetry(() => import('@/pages/auth/ResetPasswordPage'));
const AcademyDashboardPage = lazyWithRetry(() => import('@/pages/dashboard/AcademyDashboardPage'));
const CountryDashboardPage = lazyWithRetry(() => import('@/pages/dashboard/CountryDashboardPage'));
const CashierDashboardPage = lazyWithRetry(() => import('@/pages/dashboard/CashierDashboardPage'));
const ProfilePage = lazyWithRetry(() => import('@/pages/profile/ProfilePage'));
const AgencyListPage = lazyWithRetry(() => import('@/pages/agencies/AgencyListPage'));
const AgencyTrashPage = lazyWithRetry(() => import('@/pages/agencies/AgencyTrashPage'));
const AgencyOverviewPage = lazyWithRetry(() => import('@/pages/agencies/AgencyOverviewPage'));
const AgencyDepartmentsPage = lazyWithRetry(() => import('@/pages/agencies/AgencyDepartmentsPage'));
const AgencyServicesPage = lazyWithRetry(() => import('@/pages/agencies/AgencyServicesPage'));
const AgencyAcademyPage = lazyWithRetry(() => import('@/pages/agencies/AgencyAcademyPage'));
const AgencyTeamsPage = lazyWithRetry(() => import('@/pages/agencies/AgencyTeamsPage'));
const AgencySettingsPage = lazyWithRetry(() => import('@/pages/agencies/AgencySettingsPage'));
const AgencyPromotionsPage = lazyWithRetry(() => import('@/pages/agencies/AgencyPromotionsPage'));
const AgencyServiceTrashPage = lazyWithRetry(() => import('@/pages/agencies/AgencyServiceTrashPage'));
const AgencyDepartmentTrashPage = lazyWithRetry(() => import('@/pages/agencies/AgencyDepartmentTrashPage'));
const UserListPage = lazyWithRetry(() => import('@/pages/users/UserListPage'));
const DepartmentListPage = lazyWithRetry(() => import('@/pages/departments/DepartmentListPage'));
const DepartmentTrashPage = lazyWithRetry(() => import('@/pages/departments/DepartmentTrashPage'));
const DepartmentOverviewPage = lazyWithRetry(() => import('@/pages/departments/DepartmentOverviewPage'));
const DepartmentTeamsPage = lazyWithRetry(() => import('@/pages/departments/DepartmentTeamsPage'));
const DepartmentSettingsPage = lazyWithRetry(() => import('@/pages/departments/DepartmentSettingsPage'));
const RolesPrivilegesPage = lazyWithRetry(() => import('@/pages/RolesPrivilegesPage'));
const CategoryListPage = lazyWithRetry(() => import('@/pages/categories/CategoryListPage'));
const CategoryTrashPage = lazyWithRetry(() => import('@/pages/categories/CategoryTrashPage'));
const ServiceListPage = lazyWithRetry(() => import('@/pages/services/ServiceListPage'));
const DepartmentServicesPage = lazyWithRetry(() => import('@/pages/departments/DepartmentServicesPage'));
const DepartmentProductsPage = lazyWithRetry(() => import('@/pages/departments/DepartmentProductsPage'));
const ServiceTrashPage = lazyWithRetry(() => import('@/pages/services/ServiceTrashPage'));
const ReceivablesPage = lazyWithRetry(() => import('@/pages/invoices/ReceivablesPage'));
const ClientListPage = lazyWithRetry(() => import('@/pages/clients/ClientListPage'));
const ClientDetailPage = lazyWithRetry(() => import('@/pages/clients/ClientDetailPage'));
const CommercialListPage = lazyWithRetry(() => import('@/pages/commercials/CommercialListPage'));
const CommercialDetailPage = lazyWithRetry(() => import('@/pages/commercials/CommercialDetailPage'));
const CommercialSelfDashboardPage = lazyWithRetry(() => import('@/pages/commercials/CommercialSelfDashboardPage'));
const TeamTrackingPage = lazyWithRetry(() => import('@/pages/team/TeamTrackingPage'));
const CommercialCommissionsPage = lazyWithRetry(() => import('@/pages/commercials/CommercialCommissionsPage'));
const AgencyCommercialsPage = lazyWithRetry(() => import('@/pages/commercials/AgencyCommercialsPage'));
const CountryCommercialsPage = lazyWithRetry(() => import('@/pages/commercials/CountryCommercialsPage'));
const AgencyCommercialDetailPage = lazyWithRetry(
  () => import('@/pages/commercials/AgencyCommercialDetailPage')
);
const AgencyCommercialReportPage = lazyWithRetry(
  () => import('@/pages/commercials/AgencyCommercialReportPage')
);
const InvoiceListPage = lazyWithRetry(() => import('@/pages/invoices/InvoiceListPage'));
const PendingInvoicesPage = lazyWithRetry(() => import('@/pages/invoices/PendingInvoicesPage'));
const CountryPendingInvoicesPage = lazyWithRetry(() => import('@/pages/invoices/CountryPendingInvoicesPage'));
const DepartmentPendingInvoicesPage = lazyWithRetry(() => import('@/pages/invoices/DepartmentPendingInvoicesPage'));
const InvoiceFormPage = lazyWithRetry(() => import('@/pages/invoices/InvoiceFormPage'));
const QuickSalePage = lazyWithRetry(() => import('@/pages/invoices/QuickSalePage'));
const InvoiceDetailPage = lazyWithRetry(() => import('@/pages/invoices/InvoiceDetailPage'));
const AgencyInvoicesPage = lazyWithRetry(() => import('@/pages/invoices/AgencyInvoicesPage'));
const AgencyPendingInvoicesPage = lazyWithRetry(() => import('@/pages/invoices/AgencyPendingInvoicesPage'));
const AgencyInvoiceDetailPage = lazyWithRetry(() => import('@/pages/invoices/AgencyInvoiceDetailPage'));
const AgencyReceivablesPage = lazyWithRetry(() => import('@/pages/invoices/AgencyReceivablesPage'));
const AccountingPage = lazyWithRetry(() => import('@/pages/accounting/AccountingPage'));
const AgencyAccountingPage = lazyWithRetry(() => import('@/pages/accounting/AgencyAccountingPage'));
const DailyBilanPage = lazyWithRetry(() => import('@/pages/bilans/DailyBilanPage'));
const SubscriptionListPage = lazyWithRetry(() => import('@/pages/subscriptions/SubscriptionListPage'));
const CommercialReportPage = lazyWithRetry(() => import('@/pages/commercials/CommercialReportPage'));
const SubscriptionsReportPage = lazyWithRetry(() => import('@/pages/reports/SubscriptionsReportPage'));
const CustomersReportPage = lazyWithRetry(() => import('@/pages/reports/CustomersReportPage'));
const ComparisonReportPage = lazyWithRetry(() => import('@/pages/reports/ComparisonReportPage'));
const EmployeeListPage = lazyWithRetry(() => import('@/pages/employees/EmployeeListPage'));
const EmployeeDetailPage = lazyWithRetry(() => import('@/pages/employees/EmployeeDetailPage'));
const AgencyEmployeeListPage = lazyWithRetry(() => import('@/pages/employees/AgencyEmployeeListPage'));
const AgencyEmployeeDetailPage = lazyWithRetry(() => import('@/pages/employees/AgencyEmployeeDetailPage'));
const AgencyEmployeeReportPage = lazyWithRetry(() => import('@/pages/employees/AgencyEmployeeReportPage'));
const CountryEmployeeListPage = lazyWithRetry(() => import('@/pages/employees/CountryEmployeeListPage'));
const ActivityLogPage = lazyWithRetry(() => import('@/pages/audit/ActivityLogPage'));
const SettingsPage = lazyWithRetry(() => import('@/pages/settings/SettingsPage'));
const CountryListPage = lazyWithRetry(() => import('@/pages/CountryListPage'));
const AcademyCoursesPage = lazyWithRetry(() => import('@/pages/academy/AcademyCoursesPage'));
const AcademySessionsPage = lazyWithRetry(() => import('@/pages/academy/AcademySessionsPage'));
const AcademyTrainersPage = lazyWithRetry(() => import('@/pages/academy/AcademyTrainersPage'));
const AcademyTrainerDetailPage = lazyWithRetry(() => import('@/pages/academy/AcademyTrainerDetailPage'));
const AcademyLearnersPage = lazyWithRetry(() => import('@/pages/academy/AcademyLearnersPage'));
const AcademyLearnerDetailPage = lazyWithRetry(() => import('@/pages/academy/AcademyLearnerDetailPage'));
const ComingSoonPage = lazyWithRetry(() => import('@/pages/ComingSoonPage'));
const TreasuryPage = lazyWithRetry(() => import('@/pages/treasury/TreasuryPage'));
const ExpenseListPage = lazyWithRetry(() => import('@/pages/expenses/ExpenseListPage'));
const CommissionRulesPage = lazyWithRetry(() => import('@/pages/commissions/CommissionRulesPage'));
const CommissionEntriesPage = lazyWithRetry(() => import('@/pages/commissions/CommissionEntriesPage'));
const CashierCommissionsPage = lazyWithRetry(() => import('@/pages/commissions/CashierCommissionsPage'));
const CompanyListPage = lazyWithRetry(() => import('@/pages/companies/CompanyListPage'));
const OpportunityKanbanPage = lazyWithRetry(() => import('@/pages/opportunities/OpportunityKanbanPage'));
const OpportunityDetailPage = lazyWithRetry(() => import('@/pages/opportunities/OpportunityDetailPage'));
const AttendanceSheetPage = lazyWithRetry(() => import('@/pages/academy/AttendanceSheetPage'));
const CertificateListPage = lazyWithRetry(() => import('@/pages/academy/CertificateListPage'));
const CourseModulesPage = lazyWithRetry(() => import('@/pages/academy/CourseModulesPage'));
const CourseDetailPage = lazyWithRetry(() => import('@/pages/academy/CourseDetailPage'));
const FormationEnrollmentPage = lazyWithRetry(() => import('@/pages/academy/FormationEnrollmentPage'));
const SellerProfilesPage = lazyWithRetry(() => import('@/pages/academy/SellerProfilesPage'));
const AcademyProspectsPage = lazyWithRetry(() => import('@/pages/academy/AcademyProspectsPage'));
const ProspectsList = lazyWithRetry(() => import('@/components/prospects/ProspectsList'));
const AcademyReceivablesPage = lazyWithRetry(() => import('@/pages/academy/AcademyReceivablesPage'));
const AcademyReportsPage = lazyWithRetry(() => import('@/pages/academy/AcademyReportsPage'));
const AcademyPlanningPage = lazyWithRetry(() => import('@/pages/academy/AcademyPlanningPage'));
const AcademyInvoicesPage = lazyWithRetry(() => import('@/pages/academy/AcademyInvoicesPage'));
const AcademyInvoiceFormPage = lazyWithRetry(() => import('@/pages/academy/AcademyInvoiceFormPage'));
const AcademyCommissionsPage = lazyWithRetry(() => import('@/pages/academy/AcademyCommissionsPage'));
const AcademyAccountingPage = lazyWithRetry(() => import('@/pages/academy/AcademyAccountingPage'));
const AcademyBilanPage = lazyWithRetry(() => import('@/pages/academy/AcademyBilanPage'));
const ContractListPage = lazyWithRetry(() => import('@/pages/agency/ContractListPage'));
const ContractDetailPage = lazyWithRetry(() => import('@/pages/agency/ContractDetailPage'));
const RenewalsPage = lazyWithRetry(() => import('@/pages/agency/RenewalsPage'));
// Département Agency (doc/AGENCY_A_FAIRE.md)
const AgencyDeptDashboardPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptDashboardPage'));
const AgencyDeptPackagesPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptPackagesPage'));
const PrestationOffersPage = lazyWithRetry(() => import('@/pages/agency/PrestationOffersPage'));
const PrestationOfferSubscriptionsPage = lazyWithRetry(() => import('@/pages/agency/PrestationOfferSubscriptionsPage'));
const PackageSubscriptionsPage = lazyWithRetry(() => import('@/pages/agency/PackageSubscriptionsPage'));
const PrestationDetailPage = lazyWithRetry(() => import('@/pages/agency/PrestationDetailPage'));
const PrestationActionDetailPage = lazyWithRetry(() => import('@/pages/agency/PrestationActionDetailPage'));
const PrestationTrackingPage = lazyWithRetry(() => import('@/pages/agency/PrestationTrackingPage'));
const AgencyActionsBoardPage = lazyWithRetry(() => import('@/pages/agency/AgencyActionsBoardPage'));
const AgencyActionsPage = lazyWithRetry(() => import('@/pages/agency/AgencyActionsPage'));
const ClientTeamPage = lazyWithRetry(() => import('@/pages/agency/ClientTeamPage'));
const AgencyDeptInvoicesPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptInvoicesPage'));
const AgencyDeptReceivablesPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptReceivablesPage'));
const AgencyDeptCommissionsPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptCommissionsPage'));
const AgencyDeptReportsPage = lazyWithRetry(() => import('@/pages/agency/AgencyDeptReportsPage'));

function page(node: ReactNode, fallback: ReactNode = <PageSkeleton />) {
  return <Suspense fallback={fallback}>{node}</Suspense>;
}

/**
 * Enveloppe les pages d'un layout dans une route sans chemin portant l'écran
 * d'erreur : une page qui ne charge pas (coupure réseau…) affiche l'erreur à
 * sa place en gardant la navigation (sidebar, en-tête) du layout.
 */
function withErrorBoundary(children: RouteObject[]): RouteObject[] {
  return [{ errorElement: <RouteErrorPage />, children }];
}

const cards = <SkeletonCards />;
const table = <SkeletonTable rows={5} />;
const detail = <SkeletonDetail />;
const dashboard = <SkeletonDashboard />;
const form = <SkeletonForm />;

const agencyChildren: RouteObject[] = [
  { index: true, element: page(<AgencyOverviewPage />, dashboard) },
  { path: 'departments', element: page(<AgencyDepartmentsPage />, cards) },
  { path: 'departments/trash', element: page(<AgencyDepartmentTrashPage />, table) },
  { path: 'services', element: page(<AgencyServicesPage />, cards) },
  { path: 'services/trash', element: page(<AgencyServiceTrashPage />, table) },
  { path: 'academy', element: page(<AgencyAcademyPage />, cards) },
  { path: 'learners', element: page(<AcademyLearnersPage />, table) },
  { path: 'learners/:learnerId', element: page(<AcademyLearnerDetailPage />, detail) },
  { path: 'reports', element: page(<AcademyReportsPage />, table) },
  { path: 'commercials', element: page(<AgencyCommercialsPage />, table) },
  { path: 'commercials/report', element: page(<AgencyCommercialReportPage />, table) },
  { path: 'commercials/:commercialId', element: page(<AgencyCommercialDetailPage />, detail) },
  { path: 'employees', element: page(<AgencyEmployeeListPage />, table) },
  { path: 'employees/report', element: page(<AgencyEmployeeReportPage />, table) },
  { path: 'employees/:id', element: page(<AgencyEmployeeDetailPage />, detail) },
  { path: 'trainers/:trainerId', element: page(<AcademyTrainerDetailPage />, detail) },
  { path: 'invoices', element: page(<AgencyInvoicesPage />, table) },
  { path: 'invoices/pending', element: page(<AgencyPendingInvoicesPage />, table) },
  { path: 'invoices/receivables', element: page(<AgencyReceivablesPage />, table) },
  { path: 'invoices/new', element: page(<InvoiceFormPage />, form) },
  { path: 'invoices/:invoiceId', element: page(<AgencyInvoiceDetailPage />, detail) },
  { path: 'accounting', element: page(<AgencyAccountingPage />, table) },
  { path: 'bilans', element: page(<DailyBilanPage />, table) },
  { path: 'teams', element: page(<AgencyTeamsPage />, table) },
  { path: 'promotions', element: page(<AgencyPromotionsPage />, cards) },
  { path: 'settings', element: page(<AgencySettingsPage />, detail) },
];


export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    errorElement: <RouteErrorPage />,
    children: withErrorBoundary([
      { path: '/login', element: page(<LoginPage />, form) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />, form) },
      { path: '/reset-password', element: page(<ResetPasswordPage />, form) },
      { path: '/two-factor', element: page(<TwoFactorPage />, form) },
    ]),
  },
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppLayout />,
        children: withErrorBoundary([
          { path: '/', element: page(<HomeRedirect />, dashboard) },
          { path: '/caissier/dashboard', element: page(<CashierDashboardPage />, dashboard) },
          { path: '/caissier/commissions', element: page(<CashierCommissionsPage />, table) },
          { path: '/profile', element: page(<ProfilePage />, detail) },
          { path: '/countries', element: page(<CountryListPage />, cards) },
          { path: '/agencies', element: page(<AgencyListPage />, cards) },
          { path: '/agencies/trash', element: page(<AgencyTrashPage />, table) },
          { path: '/users', element: page(<UserListPage />, table) },
          { path: '/departments', element: page(<DepartmentListPage />, cards) },
          { path: '/departments/trash', element: page(<DepartmentTrashPage />, table) },
          { path: '/privileges', element: page(<RolesPrivilegesPage />, table) },
          { path: '/clients', element: page(<ClientListPage />, table) },
          { path: '/clients/:id', element: page(<ClientDetailPage />, detail) },
          { path: '/commercials', element: page(<CommercialListPage />, table) },
          { path: '/commercial/dashboard', element: page(<CommercialSelfDashboardPage />, dashboard) },
          { path: '/team/tracking', element: page(<TeamTrackingPage />, dashboard) },
          { path: '/commercial/commissions', element: page(<CommercialCommissionsPage />, dashboard) },
          { path: '/commercials/report', element: page(<CommercialReportPage />, table) },
          { path: '/commercials/:id', element: page(<CommercialDetailPage />, detail) },
          { path: '/employees', element: page(<EmployeeListPage />, table) },
          { path: '/employees/report', element: page(<CommercialReportPage mode="employee" />, table) },
          { path: '/employees/:id', element: page(<EmployeeDetailPage />, detail) },
          { path: '/trainers/:trainerId', element: page(<AcademyTrainerDetailPage />, detail) },
          { path: '/accounting', element: page(<AccountingPage />, table) },
          { path: '/treasury', element: page(<TreasuryPage />, table) },
          { path: '/expenses', element: page(<ExpenseListPage />, table) },
          { path: '/commissions/rules', element: page(<CommissionRulesPage />, table) },
          { path: '/commissions/entries', element: page(<CommissionEntriesPage />, table) },
          { path: '/prospects', element: page(<ProspectsList hideCommercialField />, table) },
          { path: '/companies', element: page(<CompanyListPage />, table) },
          { path: '/opportunities', element: page(<OpportunityKanbanPage />, table) },
          { path: '/opportunities/:id', element: page(<OpportunityDetailPage />, detail) },
          { path: '/bilans', element: page(<DailyBilanPage />, table) },
          { path: '/subscriptions', element: page(<SubscriptionListPage />, table) },
          { path: '/reports/subscriptions', element: page(<SubscriptionsReportPage />, table) },
          { path: '/reports/customers', element: page(<CustomersReportPage />, table) },
          { path: '/reports/comparison', element: page(<ComparisonReportPage />, table) },
          { path: '/invoices', element: page(<InvoiceListPage />, table) },
          { path: '/invoices/pending', element: page(<PendingInvoicesPage />, table) },
          { path: '/invoices/receivables', element: page(<ReceivablesPage />, table) },
          { path: '/invoices/new', element: page(<InvoiceFormPage />, form) },
          { path: '/invoices/quick', element: page(<QuickSalePage />, form) },
          { path: '/invoices/:id', element: page(<InvoiceDetailPage />, detail) },
          { path: '/audit', element: page(<ActivityLogPage />, table) },
          { path: '/academy', element: page(<AcademyDashboardPage />, dashboard) },
          { path: '/settings', element: page(<SettingsPage />, detail) },
          { path: '/catalog', element: <Navigate to="/catalog/services" replace /> },
          { path: '/catalog/categories', element: page(<CategoryListPage />, table) },
          { path: '/catalog/categories/trash', element: page(<CategoryTrashPage />, table) },
          { path: '/catalog/services', element: page(<ServiceListPage />, cards) },
          { path: '/catalog/services/trash', element: page(<ServiceTrashPage />, table) },
        ]),
      },
      {
        path: '/countries/:countryId',
        element: <CountryLayout />,
        children: withErrorBoundary([
          { index: true, element: page(<CountryDashboardPage />, dashboard) },
          { path: 'clients', element: page(<ClientListPage />, table) },
          { path: 'clients/:id', element: page(<ClientDetailPage />, detail) },
          { path: 'agencies', element: page(<AgencyListPage />, cards) },
          { path: 'agencies/trash', element: page(<AgencyTrashPage />, table) },
          { path: 'departments', element: page(<DepartmentListPage />, cards) },
          { path: 'departments/trash', element: page(<DepartmentTrashPage />, table) },
          { path: 'commercials', element: page(<CountryCommercialsPage />, table) },
          { path: 'commercials/report', element: page(<CommercialReportPage />, table) },
          { path: 'employees', element: page(<CountryEmployeeListPage />, table) },
          { path: 'employees/report', element: page(<CommercialReportPage mode="employee" />, table) },
          { path: 'accounting', element: page(<AccountingPage />, table) },
          { path: 'bilans', element: page(<DailyBilanPage />, table) },
          { path: 'invoices', element: page(<InvoiceListPage />, table) },
          { path: 'invoices/pending', element: page(<CountryPendingInvoicesPage />, table) },
          { path: 'invoices/new', element: page(<InvoiceFormPage />, form) },
          { path: 'invoices/:id', element: page(<InvoiceDetailPage />, detail) },
          { path: 'receivables', element: page(<ReceivablesPage />, table) },
          { path: 'audit', element: page(<ActivityLogPage />, table) },
          { path: 'academy', element: page(<AcademyDashboardPage />, dashboard) },
          { path: 'settings', element: page(<SettingsPage />, detail) },
          { path: 'services', element: page(<ServiceListPage />, cards) },
          { path: 'services/trash', element: page(<ServiceTrashPage />, table) },
          { path: 'catalog', element: <Navigate to="services" replace /> },
          { path: 'catalog/categories', element: page(<CategoryListPage />, table) },
          { path: 'catalog/services', element: <Navigate to="services" replace /> },
        ]),
      },
      {
        path: '/agencies/:agencyId/*',
        element: <AgencyRedirect />,
      },
      {
        path: '/countries/:countryId/agencies/:agencyId',
        element: <AgencyLayout />,
        children: withErrorBoundary(agencyChildren),
      },
      {
        path: '/departments/:departmentId',
        element: <DepartmentLayout />,
        children: withErrorBoundary([
          // Chemins partagés entre types de département : la page dépend du type.
          {
            index: true,
            element: page(<ByDepartmentType pages={{ agency: <AgencyDeptDashboardPage /> }} fallback={<DepartmentOverviewPage />} />, dashboard),
          },
          { path: 'team', element: page(<DepartmentTeamsPage />, table) },
          { path: 'settings', element: page(<DepartmentSettingsPage />, detail) },
          { path: 'prospects', element: page(<AcademyProspectsPage />, table) },
          {
            path: 'invoices',
            element: page(<ByDepartmentType pages={{ agency: <AgencyDeptInvoicesPage /> }} fallback={<AcademyInvoicesPage />} />, table),
          },
          // Détail d'une facture : on reste dans le département (la route
          // /agencies/... redirige vers le pays et fait perdre le contexte).
          { path: 'invoices/:invoiceId', element: page(<InvoiceDetailPage />, detail) },
          { path: 'invoices/pending', element: page(<DepartmentPendingInvoicesPage />, table) },
          {
            path: 'receivables',
            element: page(<ByDepartmentType pages={{ agency: <AgencyDeptReceivablesPage /> }} fallback={<AcademyReceivablesPage />} />, table),
          },
          {
            path: 'commissions',
            element: page(<ByDepartmentType pages={{ agency: <AgencyDeptCommissionsPage /> }} fallback={<AcademyCommissionsPage />} />, table),
          },
          {
            path: 'reports',
            element: page(<ByDepartmentType pages={{ agency: <AgencyDeptReportsPage /> }} fallback={<AcademyReportsPage />} />, table),
          },
          {
            path: 'planning',
            element: page(<ByDepartmentType pages={{ academy: <AcademyPlanningPage /> }} fallback={<ComingSoonPage />} />, table),
          },
          { path: 'accounting', element: page(<AcademyAccountingPage />, table) },
          { path: 'bilans', element: page(<AcademyBilanPage />, table) },
          { path: 'clients', element: page(<ClientListPage />, table) },
          { path: 'clients/:id', element: page(<ClientDetailPage />, detail) },
          { path: 'services', element: page(<DepartmentServicesPage />, cards) },
          { path: 'products', element: page(<DepartmentProductsPage />, cards) },
          // Academy
          { path: 'learners', element: page(<AcademyLearnersPage />, table) },
          { path: 'learners/:learnerId', element: page(<AcademyLearnerDetailPage />, detail) },
          { path: 'enrollments', element: page(<FormationEnrollmentPage />, table) },
          { path: 'courses', element: page(<AcademyCoursesPage />, cards) },
          { path: 'courses/:courseId', element: page(<CourseDetailPage />, detail) },
          { path: 'courses/:courseId/modules', element: page(<CourseModulesPage />, table) },
          { path: 'sessions', element: page(<AcademySessionsPage />, table) },
          { path: 'sessions/:sessionId/attendances', element: page(<AttendanceSheetPage />, table) },
          { path: 'trainers', element: page(<AcademyTrainersPage />, table) },
          { path: 'trainers/:trainerId', element: page(<AcademyTrainerDetailPage />, detail) },
          { path: 'presences', element: page(<AcademySessionsPage />, table) },
          { path: 'invoices/new', element: page(<AcademyInvoiceFormPage />, form) },
          { path: 'payments', element: page(<SellerProfilesPage />, table) },
          { path: 'certificates', element: page(<CertificateListPage />, table) },
          { path: 'academy', element: page(<AgencyAcademyPage />, cards) },
          // Agency
          { path: 'packages', element: page(<AgencyDeptPackagesPage />, cards) },
          { path: 'packages/:packageId/subscriptions', element: page(<PackageSubscriptionsPage />, table) },
          // Une souscription EST un contrat : l'ancienne page redirige vers l'onglet Packages.
          { path: 'subscriptions', element: <Navigate to="../contracts?origin=package" replace /> },
          // Prestations en 3 niveaux : offre → souscriptions → détail.
          { path: 'prestations', element: page(<PrestationOffersPage />, table) },
          { path: 'prestations/tracking', element: page(<PrestationTrackingPage />, table) },
          { path: 'prestations/:offerId/subscriptions', element: page(<PrestationOfferSubscriptionsPage />, table) },
          { path: 'prestations/:offerId/subscriptions/:prestationId', element: page(<PrestationDetailPage />, detail) },
          // URL historique : détail d'une souscription (pack, liens existants).
          { path: 'prestations/:prestationId', element: page(<PrestationDetailPage />, detail) },
          { path: 'prestations/:prestationId/actions/:actionId', element: page(<PrestationActionDetailPage />, detail) },
          { path: 'client-team', element: page(<ClientTeamPage />, table) },
          { path: 'contracts', element: page(<ContractListPage />, table) },
          { path: 'contracts/:contractId', element: page(<ContractDetailPage />, detail) },
          { path: 'community', element: page(<AgencyActionsBoardPage mode="community" />, table) },
          { path: 'advertising', element: page(<AgencyActionsBoardPage mode="advertising" />, table) },
          { path: 'actions', element: page(<AgencyActionsPage />, table) },
          { path: 'renewals', element: page(<RenewalsPage />, table) },
          // Store
          { path: 'catalog', element: page(<ComingSoonPage />, cards) },
          { path: 'stocks', element: page(<ComingSoonPage />, table) },
          { path: 'suppliers', element: page(<ComingSoonPage />, table) },
          { path: 'purchases', element: page(<ComingSoonPage />, table) },
          { path: 'orders', element: page(<ComingSoonPage />, table) },
          { path: 'sales', element: page(<ComingSoonPage />, table) },
          { path: 'deliveries', element: page(<ComingSoonPage />, table) },
          { path: 'returns', element: page(<ComingSoonPage />, table) },
          { path: 'inventories', element: page(<ComingSoonPage />, table) },
          // Studio
          { path: 'quotes', element: page(<ComingSoonPage />, table) },
          { path: 'projects', element: page(<ComingSoonPage />, table) },
          { path: 'production', element: page(<ComingSoonPage />, table) },
          { path: 'revisions', element: page(<ComingSoonPage />, table) },
        ]),
      },
    ],
  },
]);
