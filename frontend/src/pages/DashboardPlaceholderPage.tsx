import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';

/**
 * Page d'accueil provisoire post-connexion. Sera remplacée par le vrai
 * AppLayout + Sidebar + Dashboard (jours 4-5 et 27 du plan).
 */
export default function DashboardPlaceholderPage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-900">
      <p className="text-lg text-gray-700 dark:text-gray-200">
        Connecté en tant que <strong>{user?.username}</strong>
      </p>
      <div className="w-48">
        <Button variant="outline" onClick={() => logout()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
