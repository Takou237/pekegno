import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import TwoFactorPage from '@/pages/auth/TwoFactorPage';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage';
import DashboardPlaceholderPage from '@/pages/DashboardPlaceholderPage';
import ProfilePage from '@/pages/profile/ProfilePage';
import AgencyListPage from '@/pages/agencies/AgencyListPage';
import AgencyTrashPage from '@/pages/agencies/AgencyTrashPage';
import UserListPage from '@/pages/users/UserListPage';
import ClientsListPage from '@/pages/clients/ClientsListPage';
import DepartmentListPage from '@/pages/departments/DepartmentListPage';
import DepartmentTrashPage from '@/pages/departments/DepartmentTrashPage';
import RolesPrivilegesPage from '@/pages/RolesPrivilegesPage';
import ServiceListPage from '@/pages/services/ServiceListPage';
import ServiceTrashPage from '@/pages/services/ServiceTrashPage';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
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
          { path: '/clients', element: <ClientsListPage /> },
          { path: '/departments', element: <DepartmentListPage /> },
          { path: '/departments/trash', element: <DepartmentTrashPage /> },
          { path: '/services', element: <ServiceListPage /> },
          { path: '/services/trash', element: <ServiceTrashPage /> },
          { path: '/privileges', element: <RolesPrivilegesPage /> },
        ],
      },
    ],
  },
]);
