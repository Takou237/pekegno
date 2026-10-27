import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users.api';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';

interface CommercialPickerProps {
  value: string;
  onChange: (id: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Sélecteur de commercial/vendeur pour la souscription d'un package.
 * Affiche TOUS les utilisateurs de la plateforme (pas uniquement les profils
 * commerciaux), comme demandé.
 */
export function CommercialPicker({ value, onChange, label, error, placeholder, disabled }: CommercialPickerProps) {
  const { t } = useTranslation();

  const fetchOptions = useCallback(async (query: string): Promise<AutocompleteOption[]> => {
    const response = await usersApi.list({
      search: query.trim() || undefined,
      per_page: 20,
    });

    return (response.data ?? []).map((user) => {
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      const labelName = fullName || user.username || user.email;

      const roleLabel = user.role?.name
        ? t(`roles.${user.role.name}`, { defaultValue: user.role.name })
        : '';

      const subtitleParts = [roleLabel, user.email].filter(Boolean);

      return {
        id: user.id,
        label: labelName,
        subtitle: subtitleParts.length > 0 ? subtitleParts.join(' • ') : undefined,
      };
    });
  }, [t]);

  return (
    <Autocomplete
      label={label ?? t('agencyDept.commercial')}
      placeholder={placeholder ?? t('common.searchUser', { defaultValue: t('common.search') })}
      value={value}
      onChange={onChange}
      fetchOptions={fetchOptions}
      error={error}
      disabled={disabled}
    />
  );
}
