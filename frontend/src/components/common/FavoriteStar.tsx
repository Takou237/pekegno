import { Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFavorites } from '@/context/FavoritesContext';

/**
 * Étoile de favori affichée à côté d'un lien de navigation.
 * Toggle ajout/suppression du raccourci dans le menu des favoris.
 */
export function FavoriteStar({ to, label }: { to: string; label: string }) {
  const { t } = useTranslation();
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(to);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite({ to, label });
      }}
      title={active ? t('favorites.remove') : t('favorites.add')}
      aria-label={active ? t('favorites.remove') : t('favorites.add')}
      aria-pressed={active}
      className={`m-1 shrink-0 rounded-md p-1 transition-colors ${
        active
          ? 'text-amber-400 hover:text-amber-500'
          : 'text-gray-300 opacity-40 hover:bg-gray-100 hover:text-amber-400 hover:opacity-100 dark:text-gray-600 dark:hover:bg-gray-800'
      }`}
    >
      <Star className={`h-4 w-4 ${active ? 'fill-amber-400' : ''}`} />
    </button>
  );
}