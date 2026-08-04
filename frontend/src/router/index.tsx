import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import TwoFactorPage from '@/pages/auth/TwoFactorPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPlaceholderPage from '@/pages/DashboardPlaceholderPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import AgencyListPage from '@/pages/agencies/AgencyListPage';
import AgencyTrashPage from '@/pages/agencies/AgencyTrashPage';
import AgencyOverviewPage from '@/pages/agencies/AgencyOverviewPage';
import AgencyDepartmentsPage from '@/pages/agencies/AgencyDepartmentsPage';
import AgencyServicesPage from '@/pages/agencies/AgencyServicesPage';
import AgencyTeamsPage from '@/pages/agencies/AgencyTeamsPage';
import { AgencyLayout } from '@/components/agencies/AgencyLayout';
import UserListPage from '@/pages/users/UserListPage';
import DepartmentListPage from '@/pages/departments/DepartmentListPage';
import DepartmentTrashPage from '@/pages/departments/DepartmentTrashPage';
import RolesPrivilegesPage from '@/pages/RolesPrivilegesPage';
import CategoryListPage from '@/pages/categories/CategoryListPage';
import CategoryTrashPage from '@/pages/categories/CategoryTrashPage';
import ServiceListPage from '@/pages/services/ServiceListPage';
import ServiceTrashPage from '@/pages/services/ServiceTrashPage';
import FormationListPage from '@/pages/formations/FormationListPage';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      // Le 2FA est accessible même sans session complète (token en attente
      // stocké côté AuthContext), donc via GuestRoute plutôt que ProtectedRoute.
      { path: '/two-factor', element: <TwoFactorPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <DashboardPlaceholderPage /> },
          { path: '/profile', element: <ProfilePage /> },
          { path: '/agencies', element: <AgencyListPage /> },
          { path: '/agencies/trash', element: <AgencyTrashPage /> },
          { path: '/users', element: <UserListPage /> },
          { path: '/departments', element: <DepartmentListPage /> },
          { path: '/departments/trash', element: <DepartmentTrashPage /> },
          { path: '/privileges', element: <RolesPrivilegesPage /> },
          { path: '/catalog', element: <Navigate to="/catalog/services" replace /> },
          { path: '/catalog/categories', element: <CategoryListPage /> },
          { path: '/catalog/categories/trash', element: <CategoryTrashPage /> },
          { path: '/catalog/services', element: <ServiceListPage /> },
          { path: '/catalog/services/trash', element: <ServiceTrashPage /> },
          { path: '/catalog/formations', element: <FormationListPage /> },
        ],
      },
      {
        path: '/agencies/:agencyId',
        element: <AgencyLayout />,
        children: [
          { index: true, element: <AgencyOverviewPage /> },
          { path: 'departments', element: <AgencyDepartmentsPage /> },
          { path: 'services', element: <AgencyServicesPage /> },
          { path: 'teams', element: <AgencyTeamsPage /> },
        ],
      },
    ],
  },
]);
