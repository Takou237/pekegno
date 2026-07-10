import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { GuestRoute } from '@/router/GuestRoute';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import TwoFactorPage from '@/pages/auth/TwoFactorPage';
import DashboardPlaceholderPage from '@/pages/DashboardPlaceholderPage';

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      // Le 2FA est accessible même sans session complète (token en attente
      // stocké côté AuthContext), donc via GuestRoute plutôt que ProtectedRoute.
      { path: '/two-factor', element: <TwoFactorPage /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [{ path: '/', element: <DashboardPlaceholderPage /> }],
  },
]);
