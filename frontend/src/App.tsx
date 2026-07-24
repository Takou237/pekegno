import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { ToastContainer } from '@/components/common/ToastContainer';
import { router } from '@/router';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <ToastContainer />
        <RouterProvider router={router} />
      </AuthProvider>
    </ToastProvider>
  );
}
