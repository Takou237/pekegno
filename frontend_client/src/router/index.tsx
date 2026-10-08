import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import PublicLayout from '@/layouts/PublicLayout';
import AccountLayout from '@/layouts/AccountLayout';
import { ProtectedRoute, GuestRoute } from './guards';
import { FullPageSpinner } from '@/components/ui/Spinner';

const HomePage = lazy(() => import('@/pages/public/HomePage'));
const ProductDetailPage = lazy(() => import('@/pages/public/ProductDetailPage'));
const PackageDetailPage = lazy(() => import('@/pages/public/PackageDetailPage'));
const CartPage = lazy(() => import('@/pages/public/CartPage'));
const PaymentPage = lazy(() => import('@/pages/public/PaymentPage'));
const LoginPage = lazy(() => import('@/pages/public/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/public/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/public/ResetPasswordPage'));

const DashboardPage = lazy(() => import('@/pages/account/DashboardPage'));
const OrdersPage = lazy(() => import('@/pages/account/OrdersPage'));
const InvoicesPage = lazy(() => import('@/pages/account/InvoicesPage'));
const FormationsPage = lazy(() => import('@/pages/account/FormationsPage'));
const LearnerPage = lazy(() => import('@/pages/account/LearnerPage'));
const ProfilePage = lazy(() => import('@/pages/account/ProfilePage'));
const PrestationsPage = lazy(() => import('@/pages/account/PrestationsPage'));
const NotificationsPage = lazy(() => import('@/pages/account/NotificationsPage'));

const SuspenseWrapper = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<FullPageSpinner />}>{children}</Suspense>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <SuspenseWrapper><HomePage /></SuspenseWrapper> },
      { path: 'catalogue', element: <Navigate to="/" replace /> },
      { path: 'produits/:slug', element: <SuspenseWrapper><ProductDetailPage /></SuspenseWrapper> },
      { path: 'packages/:id', element: <SuspenseWrapper><PackageDetailPage /></SuspenseWrapper> },
      { path: 'panier', element: <SuspenseWrapper><CartPage /></SuspenseWrapper> },
      { path: 'paiement/:orderId', element: <SuspenseWrapper><PaymentPage /></SuspenseWrapper> },
      { path: 'connexion', element: <GuestRoute><SuspenseWrapper><LoginPage /></SuspenseWrapper></GuestRoute> },
      { path: 'inscription', element: <GuestRoute><SuspenseWrapper><RegisterPage /></SuspenseWrapper></GuestRoute> },
      { path: 'mot-de-passe-oublie', element: <GuestRoute><SuspenseWrapper><ForgotPasswordPage /></SuspenseWrapper></GuestRoute> },
      { path: 'reset-password', element: <GuestRoute><SuspenseWrapper><ResetPasswordPage /></SuspenseWrapper></GuestRoute> },
    ],
  },
  {
    path: '/mon-compte',
    element: <ProtectedRoute><AccountLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper> },
      { path: 'commandes', element: <SuspenseWrapper><OrdersPage /></SuspenseWrapper> },
      { path: 'factures', element: <SuspenseWrapper><InvoicesPage /></SuspenseWrapper> },
      { path: 'formations', element: <SuspenseWrapper><FormationsPage /></SuspenseWrapper> },
      { path: 'fiche-apprenant', element: <SuspenseWrapper><LearnerPage /></SuspenseWrapper> },
      { path: 'profil', element: <SuspenseWrapper><ProfilePage /></SuspenseWrapper> },
      { path: 'prestations', element: <SuspenseWrapper><PrestationsPage /></SuspenseWrapper> },
      { path: 'notifications', element: <SuspenseWrapper><NotificationsPage /></SuspenseWrapper> },
    ],
  },
  { path: '*', element: <SuspenseWrapper><HomePage /></SuspenseWrapper> },
]);
