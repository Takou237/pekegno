import { useEffect, useRef } from 'react';
import { usersApi } from '@/api/users.api';

function localSlug(first: string, last: string): string {
  const slug = (v: string) =>
    v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return [slug(first), slug(last)].filter(Boolean).join('.');
}

/**
 * Propose un nom d'utilisateur (« prenom.nom », rendu unique par le backend)
 * pendant la saisie du prénom / nom (ticket T15).
 *
 * La proposition ne remplace le champ que tant qu'il est vide ou qu'il contient
 * encore la dernière proposition : une saisie manuelle n'est jamais écrasée.
 */
export function useUsernameSuggestion(
  firstName: string,
  lastName: string,
  username: string,
  setUsername: (value: string) => void,
): void {
  const lastSuggested = useRef('');
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const setRef = useRef(setUsername);
  setRef.current = setUsername;

  useEffect(() => {
    const isAuto = () => usernameRef.current === '' || usernameRef.current === lastSuggested.current;
    if (!isAuto() || (!firstName.trim() && !lastName.trim())) return;

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      let suggestion: string | null;
      try {
        suggestion = await usersApi.suggestUsername({ first_name: firstName, last_name: lastName });
      } catch {
        suggestion = localSlug(firstName, lastName) || null;
      }
      if (cancelled || !suggestion || !isAuto()) return;
      lastSuggested.current = suggestion;
      setRef.current(suggestion);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [firstName, lastName]);
}
