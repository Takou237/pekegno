import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { OrgProvider } from '@/context/OrgContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { ToastProvider } from '@/context/ToastContext';
import { ToastContainer } from '@/components/common/ToastContainer';
import { router } from '@/router';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <OrgProvider>
          <FavoritesProvider>
            <ToastContainer />
            <RouterProvider router={router} />
          </FavoritesProvider>
        </OrgProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
