import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
];

// B26 : comme le middleware InactivityLogout du backend — 24 h d'inactivité,
// 12 h pour la direction générale.
const DEFAULT_TIMEOUT_MINUTES = 1440;
const DG_TIMEOUT_MINUTES = 720;

/**
 * Déconnecte automatiquement l'utilisateur après N minutes d'inactivité.
 * Doit rester cohérent avec le middleware InactivityLogout + SESSION_LIFETIME
 * côté backend (Dev1) : si le back invalide déjà la session, le prochain
 * appel API renverra un 401 que le client Axios traite de toute façon
 * (voir api/client.ts). Ce hook évite juste d'attendre un appel réseau pour
 * prévenir l'utilisateur côté front.
 */
export function useInactivityLogout(): void {
  const { isAuthenticated, logout, user } = useAuth();
  const isDg = user?.role?.name === 'direction-generale';
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const timeoutMinutes = isDg
      ? DG_TIMEOUT_MINUTES
      : Number(import.meta.env.VITE_INACTIVITY_TIMEOUT_MINUTES ?? DEFAULT_TIMEOUT_MINUTES);
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        logout();
      }, timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, resetTimer, { passive: true })
    );
    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, resetTimer)
      );
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isAuthenticated, logout, isDg]);
}
