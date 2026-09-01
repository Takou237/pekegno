import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Star, X, Trash2, ExternalLink } from 'lucide-react';
import { useFavorites } from '@/context/FavoritesContext';

/**
 * Dropdown « Favoris » dans le header : liste les raccourcis de navigation
 * étoilés depuis les sidebars, avec navigation et suppression rapide.
 */
export function FavoritesMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { favorites, removeFavorite, clearFavorites } = useFavorites();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        aria-label={t('favorites.title')}
      >
        <Star className="h-4.5 w-4.5" />
        {favorites.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold leading-none text-white">
            {favorites.length > 99 ? '99+' : favorites.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('favorites.title')}
            </span>
            {favorites.length > 0 && (
              <button
                type="button"
                onClick={clearFavorites}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t('favorites.clearAll')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                <Star className="h-8 w-8" />
                <span className="text-sm">{t('favorites.empty')}</span>
              </div>
            ) : (
              favorites.map((favorite) => (
                <div
                  key={favorite.to}
                  className="group flex w-full items-stretch text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate(favorite.to);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 px-4 py-3"
                  >
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                    <span className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                      {favorite.label}
                    </span>
                    <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFavorite(favorite.to)}
                    title={t('favorites.remove')}
                    aria-label={t('favorites.remove')}
                    className="m-1 shrink-0 rounded-md p-1.5 text-gray-300 hover:bg-error-50 hover:text-error-500 dark:text-gray-600 dark:hover:bg-error-500/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}