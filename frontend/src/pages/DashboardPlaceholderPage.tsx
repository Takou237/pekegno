import { useAuth } from '@/hooks/useAuth';

export default function DashboardPlaceholderPage() {
  const { user } = useAuth();

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Bienvenue, {user?.first_name ?? user?.username} 👋
      </h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Le vrai tableau de bord (indicateurs, graphiques) arrive au Jour 27 du plan.
        En attendant, la gestion des agences est disponible dans le menu.
      </p>
    </div>
  );
}
