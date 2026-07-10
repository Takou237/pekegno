import { useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';

/**
 * Hook d'accès à la session courante (jour 2 du plan d'exécution).
 * Doit être utilisé sous <AuthProvider> (monté dans App.tsx).
 */
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth doit être utilisé à l\'intérieur de <AuthProvider>.');
  }

  return context;
}
