import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';

export interface FavoriteItem {
  to: string;
  label: string;
}

interface FavoritesContextValue {
  favorites: FavoriteItem[];
  isFavorite: (to: string) => boolean;
  toggleFavorite: (item: FavoriteItem) => void;
  removeFavorite: (to: string) => void;
  clearFavorites: () => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function sanitize(raw: unknown): FavoriteItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is FavoriteItem =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as FavoriteItem).to === 'string' &&
      typeof (item as FavoriteItem).label === 'string',
  );
}

function storageKey(userId: string | null): string | null {
  return userId ? `pekegno:favorites:${userId}` : null;
}

/**
 * Favoris persistant (localStorage) par utilisateur.
 * Accueille des raccourcis de navigation (« sidebar + dropdown header »).
 */
export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const key = storageKey(user?.id ?? null);

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    if (!key) return [];
    try {
      return sanitize(JSON.parse(localStorage.getItem(key) ?? '[]'));
    } catch {
      return [];
    }
  });

  // Recharge les favoris du bon utilisateur quand la session change.
  useEffect(() => {
    if (!key) {
      setFavorites([]);
      return;
    }
    try {
      setFavorites(sanitize(JSON.parse(localStorage.getItem(key) ?? '[]')));
    } catch {
      setFavorites([]);
    }
  }, [key]);

  useEffect(() => {
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(favorites));
    } catch {
      /* stockage indisponible : on ignore */
    }
  }, [key, favorites]);

  const toggleFavorite = useCallback((item: FavoriteItem) => {
    setFavorites((prev) =>
      prev.some((f) => f.to === item.to)
        ? prev.filter((f) => f.to !== item.to)
        : [...prev, item],
    );
  }, []);

  const isFavorite = useCallback(
    (to: string) => favorites.some((f) => f.to === to),
    [favorites],
  );

  const removeFavorite = useCallback((to: string) => {
    setFavorites((prev) => prev.filter((f) => f.to !== to));
  }, []);

  const clearFavorites = useCallback(() => setFavorites([]), []);

  const value = useMemo<FavoritesContextValue>(
    () => ({ favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites }),
    [favorites, isFavorite, toggleFavorite, removeFavorite, clearFavorites],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites doit être utilisé à l\'intérieur de <FavoritesProvider>.');
  }
  return ctx;
}