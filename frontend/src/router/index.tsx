import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AgencyLayout } from '@/components/agencies/AgencyLayout';
import { AgencyRedirect } from '@/components/agencies/AgencyRedirect';
import { CountryLayout } from '@/components/countries/CountryLayout';
import { DepartmentLayout } from '@/components/departments/DepartmentLayout';
import {
  PageSkeleton,
  SkeletonCards,
  SkeletonDashboard,
  SkeletonDetail,
  SkeletonForm,
  SkeletonTable,
} from '@/components/ui/Skeleton';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('@/pages/auth/TwoFactorPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const RegisterPage = lazy(() => import('@/pages/register/RegisterPage'));
const PEKEGNOGroupDashboard = lazy(() => import('@/pages/dashboard/PEKEGNOGroupDashboard'));
const CountryDashboardPage = lazy(() => import('@/pages/dashboard/CountryDashboardPage'));
const ProfilePage = lazy(() => import('@/pages/profile/ProfilePage'));
const AgencyListPage = lazy(() => import('@/pages/agencies/AgencyListPage'));
const AgencyTrashPage = lazy(() => import('@/pages/agencies/AgencyTrashPage'));
const AgencyOverviewPage = lazy(() => import('@/pages/agencies/AgencyOverviewPage'));
const AgencyDepartmentsPage = lazy(() => import('@/pages/agencies/AgencyDepartmentsPage'));
const AgencyServicesPage = lazy(() => import('@/pages/agencies/AgencyServicesPage'));
const AgencyTeamsPage = lazy(() => import('@/pages/agencies/AgencyTeamsPage'));
const AgencySettingsPage = lazy(() => import('@/pages/agencies/AgencySettingsPage'));
const AgencyPromotionsPage = lazy(() => import('@/pages/agencies/AgencyPromotionsPage'));
const AgencyServiceTrashPage = lazy(() => import('@/pages/agencies/AgencyServiceTrashPage'));
const AgencyDepartmentTrashPage = lazy(() => import('@/pages/agencies/AgencyDepartmentTrashPage'));
const UserListPage = lazy(() => import('@/pages/users/UserListPage'));
const DepartmentListPage = lazy(() => import('@/pages/departments/DepartmentListPage'));
const DepartmentTrashPage = lazy(() => import('@/pages/departments/DepartmentTrashPage'));
const DepartmentOverviewPage = lazy(() => import('@/pages/departments/DepartmentOverviewPage'));
const DepartmentTeamsPage = lazy(() => import('@/pages/departments/DepartmentTeamsPage'));
const DepartmentSettingsPage = lazy(() => import('@/pages/departments/DepartmentSettingsPage'));
const RolesPrivilegesPage = lazy(() => import('@/pages/RolesPrivilegesPage'));
const CategoryListPage = lazy(() => import('@/pages/categories/CategoryListPage'));
const CategoryTrashPage = lazy(() => import('@/pages/categories/CategoryTrashPage'));
const ServiceListPage = lazy(() => import('@/pages/services/ServiceListPage'));
const ServiceTrashPage = lazy(() => import('@/pages/services/ServiceTrashPage'));
const ClientListPage = lazy(() => import('@/pages/clients/ClientListPage'));
const ClientDetailPage = lazy(() => import('@/pages/clients/ClientDetailPage'));
const CommercialListPage = lazy(() => import('@/pages/commercials/CommercialListPage'));
const CommercialDetailPage = lazy(() => import('@/pages/commercials/CommercialDetailPage'));
const AgencyCommercialsPage = lazy(() => import('@/pages/commercials/AgencyCommercialsPage'));
const AgencyCommercialDetailPage = lazy(
  () => import('@/pages/commercials/AgencyCommercialDetailPage')
);
const AgencyCommercialReportPage = lazy(
  () => import('@/pages/commercials/AgencyCommercialReportPage')
);
const InvoiceListPage = lazy(() => import('@/pages/invoices/InvoiceListPage'));
const InvoiceFormPage = lazy(() => import('@/pages/invoices/InvoiceFormPage'));
const QuickSalePage = lazy(() => import('@/pages/invoices/QuickSalePage'));
const InvoiceDetailPage = lazy(() => import('@/pages/invoices/InvoiceDetailPage'));
const AgencyInvoicesPage = lazy(() => import('@/pages/invoices/AgencyInvoicesPage'));
const AgencyInvoiceDetailPage = lazy(() => import('@/pages/invoices/AgencyInvoiceDetailPage'));
const AccountingPage = lazy(() => import('@/pages/accounting/AccountingPage'));
const AgencyAccountingPage = lazy(() => import('@/pages/accounting/AgencyAccountingPage'));
const DailyBilanPage = lazy(() => import('@/pages/bilans/DailyBilanPage'));
const SubscriptionListPage = lazy(() => import('@/pages/subscriptions/SubscriptionListPage'));
const AgencySubscriptionsPage = lazy(() => import('@/pages/subscriptions/AgencySubscriptionsPage'));
const CommercialReportPage = lazy(() => import('@/pages/commercials/CommercialReportPage'));
const EmployeeListPage = lazy(() => import('@/pages/employees/EmployeeListPage'));
const EmployeeDetailPage = lazy(() => import('@/pages/employees/EmployeeDetailPage'));
const AgencyEmployeeListPage = lazy(() => import('@/pages/employees/AgencyEmployeeListPage'));
const AgencyEmployeeDetailPage = lazy(() => import('@/pages/employees/AgencyEmployeeDetailPage'));
const ActivityLogPage = lazy(() => import('@/pages/audit/ActivityLogPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));
const CountryListPage = lazy(() => import('@/pages/CountryListPage'));
const AcademyCoursesPage = lazy(() => import('@/pages/academy/AcademyCoursesPage'));
const AcademySessionsPage = lazy(() => import('@/pages/academy/AcademySessionsPage'));
const AcademyTrainersPage = lazy(() => import('@/pages/academy/AcademyTrainersPage'));
const AcademyTrainerDetailPage = lazy(() => import('@/pages/academy/AcademyTrainerDetailPage'));
const AcademyLearnersPage = lazy(() => import('@/pages/academy/AcademyLearnersPage'));
const AcademyLearnerDetailPage = lazy(() => import('@/pages/academy/AcademyLearnerDetailPage'));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));
const TreasuryPage = lazy(() => import('@/pages/treasury/TreasuryPage'));
const ExpenseListPage = lazy(() => import('@/pages/expenses/ExpenseListPage'));
const CommissionRulesPage = lazy(() => import('@/pages/commissions/CommissionRulesPage'));
const CommissionEntriesPage = lazy(() => import('@/pages/commissions/CommissionEntriesPage'));
const CompanyListPage = lazy(() => import('@/pages/companies/CompanyListPage'));
const OpportunityKanbanPage = lazy(() => import('@/pages/opportunities/OpportunityKanbanPage'));
const OpportunityDetailPage = lazy(() => import('@/pages/opportunities/OpportunityDetailPage'));
const AttendanceSheetPage = lazy(() => import('@/pages/academy/AttendanceSheetPage'));
const CertificateListPage = lazy(() => import('@/pages/academy/CertificateListPage'));
const CourseModulesPage = lazy(() => import('@/pages/academy/CourseModulesPage'));
const FormationEnrollmentPage = lazy(() => import('@/pages/academy/FormationEnrollmentPage'));
const SellerProfilesPage = lazy(() => import('@/pages/academy/SellerProfilesPage'));
const AcademyProspectsPage = lazy(() => import('@/pages/academy/AcademyProspectsPage'));
const AcademyReceivablesPage = lazy(() => import('@/pages/academy/AcademyReceivablesPage'));
const AcademyReportsPage = lazy(() => import('@/pages/academy/AcademyReportsPage'));
const ContractListPage = lazy(() => import('@/pages/agency/ContractListPage'));
const ContractDetailPage = lazy(() => import('@/pages/agency/ContractDetailPage'));
const RenewalsPage = lazy(() => import('@/pages/agency/RenewalsPage'));

function page(node: ReactNode, fallback: ReactNode = <PageSkeleton />) {
  return <Suspense fallback={fallback}>{node}</Suspense>;
}

const cards = <SkeletonCards />;
const table = <SkeletonTable rows={5} />;
const detail = <SkeletonDetail />;
const dashboard = <SkeletonDashboard />;
const form = <SkeletonForm />;

const agencyChildren = [
  { index: true, element: page(<AgencyOverviewPage />, dashboard) },
  { path: 'departments', element: page(<AgencyDepartmentsPage />, cards) },
  { path: 'departments/trash', element: page(<AgencyDepartmentTrashPage />, table) },
  { path: 'services', element: page(<AgencyServicesPage />, cards) },
  { path: 'services/trash', element: page(<AgencyServiceTrashPage />, table) },
  { path: 'commercials', element: page(<AgencyCommercialsPage />, table) },
  { path: 'commercials/report', element: page(<AgencyCommercialReportPage />, table) },
  { path: 'commercials/:commercialId', element: page(<AgencyCommercialDetailPage />, detail) },
  { path: 'employees', element: page(<AgencyEmployeeListPage />, table) },
  { path: 'employees/:id', element: page(<AgencyEmployeeDetailPage />, detail) },
  { path: 'invoices', element: page(<AgencyInvoicesPage />, table) },
  { path: 'invoices/new', element: page(<InvoiceFormPage />, form) },
  { path: 'invoices/:invoiceId', element: page(<AgencyInvoiceDetailPage />, detail) },
  { path: 'accounting', element: page(<AgencyAccountingPage />, table) },
  { path: 'bilans', element: page(<DailyBilanPage />, table) },
  { path: 'subscriptions', element: page(<AgencySubscriptionsPage />, table) },
  { path: 'teams', element: page(<AgencyTeamsPage />, table) },
  { path: 'promotions', element: page(<AgencyPromotionsPage />, cards) },
  { path: 'settings', element: page(<AgencySettingsPage />, detail) },
];


export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: page(<LoginPage />, form) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />, form) },
      { path: '/reset-password', element: page(<ResetPasswordPage />, form) },
      { path: '/two-factor', element: page(<TwoFactorPage />, form) },
      { path: '/register', element: page(<RegisterPage />, form) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: page(<PEKEGNOGroupDashboard />, dashboard) },
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
          { path: '/commercials/report', element: page(<CommercialReportPage />, table) },
          { path: '/commercials/:id', element: page(<CommercialDetailPage />, detail) },
          { path: '/employees', element: page(<EmployeeListPage />, table) },
          { path: '/employees/:id', element: page(<EmployeeDetailPage />, detail) },
          { path: '/accounting', element: page(<AccountingPage />, table) },
          { path: '/treasury', element: page(<TreasuryPage />, table) },
          { path: '/expenses', element: page(<ExpenseListPage />, table) },
          { path: '/commissions/rules', element: page(<CommissionRulesPage />, table) },
          { path: '/commissions/entries', element: page(<CommissionEntriesPage />, table) },
          { path: '/companies', element: page(<CompanyListPage />, table) },
          { path: '/opportunities', element: page(<OpportunityKanbanPage />, table) },
          { path: '/opportunities/:id', element: page(<OpportunityDetailPage />, detail) },
          { path: '/bilans', element: page(<DailyBilanPage />, table) },
          { path: '/subscriptions', element: page(<SubscriptionListPage />, table) },
          { path: '/invoices', element: page(<InvoiceListPage />, table) },
          { path: '/invoices/new', element: page(<InvoiceFormPage />, form) },
          { path: '/invoices/quick', element: page(<QuickSalePage />, form) },
          { path: '/invoices/:id', element: page(<InvoiceDetailPage />, detail) },
          { path: '/audit', element: page(<ActivityLogPage />, table) },
          { path: '/settings', element: page(<SettingsPage />, detail) },
          { path: '/catalog', element: <Navigate to="/catalog/services" replace /> },
          { path: '/catalog/categories', element: page(<CategoryListPage />, table) },
          { path: '/catalog/categories/trash', element: page(<CategoryTrashPage />, table) },
          { path: '/catalog/services', element: page(<ServiceListPage />, cards) },
          { path: '/catalog/services/trash', element: page(<ServiceTrashPage />, table) },
        ],
      },
      {
        path: '/countries/:countryId',
        element: <CountryLayout />,
        children: [
          { index: true, element: page(<CountryDashboardPage />, dashboard) },
          { path: 'clients', element: page(<ClientListPage />, table) },
          { path: 'clients/:id', element: page(<ClientDetailPage />, detail) },
          { path: 'agencies', element: page(<AgencyListPage />, cards) },
          { path: 'agencies/trash', element: page(<AgencyTrashPage />, table) },
          { path: 'users', element: page(<UserListPage />, table) },
          { path: 'departments', element: page(<DepartmentListPage />, cards) },
          { path: 'departments/trash', element: page(<DepartmentTrashPage />, table) },
          { path: 'privileges', element: page(<RolesPrivilegesPage />, table) },
          { path: 'commercials', element: page(<CommercialListPage />, table) },
          { path: 'commercials/report', element: page(<CommercialReportPage />, table) },
          { path: 'employees', element: page(<EmployeeListPage />, table) },
          { path: 'accounting', element: page(<AccountingPage />, table) },
          { path: 'bilans', element: page(<DailyBilanPage />, table) },
          { path: 'subscriptions', element: page(<SubscriptionListPage />, table) },
          { path: 'invoices', element: page(<InvoiceListPage />, table) },
          { path: 'invoices/new', element: page(<InvoiceFormPage />, form) },
          { path: 'invoices/:id', element: page(<InvoiceDetailPage />, detail) },
          { path: 'audit', element: page(<ActivityLogPage />, table) },
          { path: 'settings', element: page(<SettingsPage />, detail) },
          { path: 'catalog', element: <Navigate to="services" replace /> },
          { path: 'catalog/categories', element: page(<CategoryListPage />, table) },
          { path: 'catalog/services', element: page(<ServiceListPage />, cards) },
        ],
      },
      {
        path: '/agencies/:agencyId/*',
        element: <AgencyRedirect />,
      },
      {
        path: '/countries/:countryId/agencies/:agencyId',
        element: <AgencyLayout />,
        children: agencyChildren,
      },
      {
        path: '/departments/:departmentId',
        element: <DepartmentLayout />,
        children: [
          { index: true, element: page(<DepartmentOverviewPage />, dashboard) },
          { path: 'team', element: page(<DepartmentTeamsPage />, table) },
          { path: 'settings', element: page(<DepartmentSettingsPage />, detail) },
          // Academy routes
          { path: 'prospects', element: page(<AcademyProspectsPage />, table) },
          { path: 'learners', element: page(<AcademyLearnersPage />, table) },
          { path: 'learners/:learnerId', element: page(<AcademyLearnerDetailPage />, detail) },
          { path: 'enrollments', element: page(<FormationEnrollmentPage />, table) },
          { path: 'courses', element: page(<AcademyCoursesPage />, cards) },
          { path: 'courses/:courseId/modules', element: page(<CourseModulesPage />, table) },
          { path: 'sessions', element: page(<AcademySessionsPage />, table) },
          { path: 'sessions/:sessionId/attendances', element: page(<AttendanceSheetPage />, table) },
          { path: 'trainers', element: page(<AcademyTrainersPage />, table) },
          { path: 'trainers/:trainerId', element: page(<AcademyTrainerDetailPage />, detail) },
          { path: 'presences', element: page(<AcademySessionsPage />, table) },
          { path: 'payments', element: page(<SellerProfilesPage />, table) },
          { path: 'receivables', element: page(<AcademyReceivablesPage />, table) },
          { path: 'certificates', element: page(<CertificateListPage />, table) },
          { path: 'reports', element: page(<AcademyReportsPage />, table) },
          // Agency routes
          { path: 'clients', element: page(<ClientListPage />, table) },
          { path: 'clients/:id', element: page(<ClientDetailPage />, detail) },
          { path: 'packages', element: page(<ComingSoonPage />, cards) },
          { path: 'contracts', element: page(<ContractListPage />, table) },
          { path: 'contracts/:contractId', element: page(<ContractDetailPage />, detail) },
          { path: 'services', element: page(<ServiceListPage />, cards) },
          { path: 'community', element: page(<ComingSoonPage />, table) },
          { path: 'advertising', element: page(<ComingSoonPage />, table) },
          { path: 'renewals', element: page(<RenewalsPage />, table) },
          // Store routes
          { path: 'catalog', element: page(<ComingSoonPage />, cards) },
          { path: 'stocks', element: page(<ComingSoonPage />, table) },
          { path: 'suppliers', element: page(<ComingSoonPage />, table) },
          { path: 'purchases', element: page(<ComingSoonPage />, table) },
          { path: 'orders', element: page(<ComingSoonPage />, table) },
          { path: 'sales', element: page(<ComingSoonPage />, table) },
          { path: 'deliveries', element: page(<ComingSoonPage />, table) },
          { path: 'returns', element: page(<ComingSoonPage />, table) },
          { path: 'inventories', element: page(<ComingSoonPage />, table) },
          // Studio routes
          { path: 'quotes', element: page(<ComingSoonPage />, table) },
          { path: 'projects', element: page(<ComingSoonPage />, table) },
          { path: 'planning', element: page(<ComingSoonPage />, table) },
          { path: 'production', element: page(<ComingSoonPage />, table) },
          { path: 'revisions', element: page(<ComingSoonPage />, table) },
        ],
      },
    ],
  },
]);
