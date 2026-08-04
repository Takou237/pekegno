import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { AgencyLayout } from '@/components/agencies/AgencyLayout';
import { DepartmentLayout } from '@/components/departments/DepartmentLayout';
import { Spinner } from '@/components/ui/Spinner';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const TwoFactorPage = lazy(() => import('@/pages/auth/TwoFactorPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPlaceholderPage'));
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

function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}

function page(node: ReactNode) {
  return <Suspense fallback={<PageFallback />}>{node}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: page(<LoginPage />) },
      { path: '/forgot-password', element: page(<ForgotPasswordPage />) },
      { path: '/reset-password', element: page(<ResetPasswordPage />) },
      // Le 2FA est accessible même sans session complète (token en attente
      // stocké côté AuthContext), donc via GuestRoute plutôt que ProtectedRoute.
      { path: '/two-factor', element: page(<TwoFactorPage />) },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: page(<DashboardPage />) },
          { path: '/profile', element: page(<ProfilePage />) },
          { path: '/agencies', element: page(<AgencyListPage />) },
          { path: '/agencies/trash', element: page(<AgencyTrashPage />) },
          { path: '/users', element: page(<UserListPage />) },
          { path: '/departments', element: page(<DepartmentListPage />) },
          { path: '/departments/trash', element: page(<DepartmentTrashPage />) },
          { path: '/privileges', element: page(<RolesPrivilegesPage />) },
          { path: '/catalog', element: <Navigate to="/catalog/services" replace /> },
          { path: '/catalog/categories', element: page(<CategoryListPage />) },
          { path: '/catalog/categories/trash', element: page(<CategoryTrashPage />) },
          { path: '/catalog/services', element: page(<ServiceListPage />) },
          { path: '/catalog/services/trash', element: page(<ServiceTrashPage />) },
        ],
      },
      {
        path: '/agencies/:agencyId',
        element: <AgencyLayout />,
        children: [
          { index: true, element: page(<AgencyOverviewPage />) },
          { path: 'departments', element: page(<AgencyDepartmentsPage />) },
          { path: 'departments/trash', element: page(<AgencyDepartmentTrashPage />) },
          { path: 'services', element: page(<AgencyServicesPage />) },
          { path: 'services/trash', element: page(<AgencyServiceTrashPage />) },
          { path: 'teams', element: page(<AgencyTeamsPage />) },
          { path: 'promotions', element: page(<AgencyPromotionsPage />) },
          { path: 'settings', element: page(<AgencySettingsPage />) },
        ],
      },
      {
        path: '/departments/:departmentId',
        element: <DepartmentLayout />,
        children: [
          { index: true, element: page(<DepartmentOverviewPage />) },
          { path: 'team', element: page(<DepartmentTeamsPage />) },
          { path: 'settings', element: page(<DepartmentSettingsPage />) },
        ],
      },
    ],
  },
]);
