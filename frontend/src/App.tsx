import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { OrgProvider } from '@/context/OrgContext';
import { ToastProvider } from '@/context/ToastContext';
import { ToastContainer } from '@/components/common/ToastContainer';
import { router } from '@/router';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <OrgProvider>
          <ToastContainer />
          <RouterProvider router={router} />
        </OrgProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
