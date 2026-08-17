import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AgencyLayout } from '@/components/agencies/AgencyLayout';
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
const DashboardPage = lazy(() => import('@/pages/AdminDashboardPage'));
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

function page(node: ReactNode, fallback: ReactNode = <PageSkeleton />) {
  return <Suspense fallback={fallback}>{node}</Suspense>;
}

const cards = <SkeletonCards />;
const table = <SkeletonTable rows={5} />;
const detail = <SkeletonDetail />;
const dashboard = <SkeletonDashboard />;
const form = <SkeletonForm />;

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: page(<LoginPage />, form) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />, form) },
      { path: '/reset-password', element: page(<ResetPasswordPage />, form) },
      // Le 2FA est accessible même sans session complète (token en attente
      // stocké côté AuthContext), donc via GuestRoute plutôt que ProtectedRoute.
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
          { path: '/', element: page(<DashboardPage />, dashboard) },
          { path: '/profile', element: page(<ProfilePage />, detail) },
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
        path: '/agencies/:agencyId',
        element: <AgencyLayout />,
        children: [
          { index: true, element: page(<AgencyOverviewPage />, dashboard) },
          { path: 'departments', element: page(<AgencyDepartmentsPage />, cards) },
          { path: 'departments/trash', element: page(<AgencyDepartmentTrashPage />, table) },
          { path: 'services', element: page(<AgencyServicesPage />, cards) },
          { path: 'services/trash', element: page(<AgencyServiceTrashPage />, table) },
          { path: 'commercials', element: page(<AgencyCommercialsPage />, table) },
          { path: 'commercials/:commercialId', element: page(<AgencyCommercialDetailPage />, detail) },
          { path: 'employees', element: page(<AgencyEmployeeListPage />, table) },
          { path: 'employees/:employeeId', element: page(<AgencyEmployeeDetailPage />, detail) },
          { path: 'invoices', element: page(<AgencyInvoicesPage />, table) },
          { path: 'invoices/new', element: page(<InvoiceFormPage />, form) },
          { path: 'invoices/:invoiceId', element: page(<AgencyInvoiceDetailPage />, detail) },
          { path: 'accounting', element: page(<AgencyAccountingPage />, table) },
          { path: 'bilans', element: page(<DailyBilanPage />, table) },
          { path: 'subscriptions', element: page(<AgencySubscriptionsPage />, table) },
          { path: 'teams', element: page(<AgencyTeamsPage />, table) },
          { path: 'promotions', element: page(<AgencyPromotionsPage />, cards) },
          { path: 'settings', element: page(<AgencySettingsPage />, detail) },
        ],
      },
      {
        path: '/departments/:departmentId',
        element: <DepartmentLayout />,
        children: [
          { index: true, element: page(<DepartmentOverviewPage />, dashboard) },
          { path: 'team', element: page(<DepartmentTeamsPage />, table) },
          { path: 'settings', element: page(<DepartmentSettingsPage />, detail) },
        ],
      },
    ],
  },
]);
