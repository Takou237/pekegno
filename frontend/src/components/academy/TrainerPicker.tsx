import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { academyApi } from '@/api/academy.api';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';

/** Préfixes de la valeur composite : `user:<uuid>` ou `profile:<uuid>`. */
export const TRAINER_USER_PREFIX = 'user:';
export const TRAINER_PROFILE_PREFIX = 'profile:';

/**
 * Traduit la valeur composite du sélecteur en champs attendus par l'API :
 * `trainer_user_id` pour un compte interne, `trainer_id` pour un profil
 * formateur autonome (intervenant externe).
 */
export function parseTrainerRef(ref: string): { trainer_user_id: string | null; trainer_id: string | null } {
  if (ref.startsWith(TRAINER_USER_PREFIX)) {
    return { trainer_user_id: ref.slice(TRAINER_USER_PREFIX.length) || null, trainer_id: null };
  }

  if (ref.startsWith(TRAINER_PROFILE_PREFIX)) {
    return { trainer_user_id: null, trainer_id: ref.slice(TRAINER_PROFILE_PREFIX.length) || null };
  }

  return { trainer_user_id: null, trainer_id: null };
}

interface TrainerPickerProps {
  agencyId?: string;
  label?: string;
  value: string;
  onChange: (ref: string) => void;
  error?: string;
  /** Libellé de la valeur courante (session éditée), pour un affichage immédiat. */
  selectedOption?: AutocompleteOption | null;
}

/**
 * Sélecteur d'animateur de session : n'importe quel employé interne (tous
 * rôles sauf client) ou un profil formateur sans compte, avec recherche et
 * filtre par rôle.
 */
export function TrainerPicker({ agencyId, label, value, onChange, error, selectedOption }: TrainerPickerProps) {
  const { t } = useTranslation();
  const [roleFilter, setRoleFilter] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  useEffect(() => {
    let active = true;

    academyApi
      .trainerCandidates({ per_page: 1, agency_id: undefined })
      .then((response) => {
        if (active) setRoles(response.meta?.roles ?? []);
      })
      .catch(() => {
        if (active) setRoles([]);
      });

    return () => {
      active = false;
    };
  }, []);

  const fetchOptions = useCallback(
    async (query: string): Promise<AutocompleteOption[]> => {
      const response = await academyApi.trainerCandidates({
        // Pas de restriction agency_id : afficher tous les utilisateurs de la plateforme
        agency_id: undefined,
        search: query.trim() || undefined,
        role: roleFilter || undefined,
        per_page: 20,
      });

      return response.data.map((candidate) => {
        const ref =
          candidate.kind === 'user'
            ? `${TRAINER_USER_PREFIX}${candidate.user_id}`
            : `${TRAINER_PROFILE_PREFIX}${candidate.trainer_id}`;
        const name =
          [candidate.first_name, candidate.last_name].filter(Boolean).join(' ') || candidate.email || '—';
        const roleLabel = candidate.role ? t(`roles.${candidate.role}`) : '';
        const subtitle = [
          roleLabel,
          candidate.agency?.name,
          candidate.is_active ? '' : t('common.inactive'),
        ]
          .filter(Boolean)
          .join(' · ');

        return { id: ref, label: name, subtitle: subtitle || candidate.email || undefined };
      });
    },
    [agencyId, roleFilter, t],
  );

  return (
    <div className="flex flex-col gap-3">
      <Autocomplete
        label={label ?? t('nav.trainers')}
        placeholder={t('academy.searchTrainerPlaceholder')}
        value={value}
        onChange={onChange}
        fetchOptions={fetchOptions}
        error={error}
        refreshKey={roleFilter}
        selectedOption={selectedOption}
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {t('academy.trainerRoleFilter')}
        </label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        >
          <option value="">{t('academy.allRoles')}</option>
          {roles.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
