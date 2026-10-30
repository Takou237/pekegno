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
  /** Libellé de `value` s'il n'est pas dans la première page de résultats. */
  selectedOption?: AutocompleteOption | null;
}

/**
 * Sélecteur de commercial/vendeur pour la souscription d'un package.
 * Affiche TOUS les utilisateurs de la plateforme (pas uniquement les profils
 * commerciaux), sauf le super-admin.
 */
export function CommercialPicker({ value, onChange, label, error, placeholder, disabled, selectedOption }: CommercialPickerProps) {
  const { t } = useTranslation();

  const fetchOptions = useCallback(async (query: string): Promise<AutocompleteOption[]> => {
    const response = await usersApi.list({
      search: query.trim() || undefined,
      exclude_role: 'super-admin',
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
      selectedOption={selectedOption}
    />
  );
}

/** Sélection d'un employé (membre d'équipe, assigné d'une action). */
export function EmployeePicker({
  label,
  value,
  onChange,
  error,
  agencyId,
}: {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  agencyId?: string;
}) {
  const { t } = useTranslation();
  const fetchOptions = async (q: string): Promise<AutocompleteOption[]> => {
    const res = await usersApi.list({ search: q, agency_id: agencyId, per_page: 10 });
    return res.data
      .filter((u) => u.role?.name !== 'client')
      .map((u) => ({ id: u.id, label: u.name || [u.first_name, u.last_name].filter(Boolean).join(' '), subtitle: u.role?.name ?? u.email }));
  };
  return <Autocomplete label={label ?? t('agencyDept.employee')} value={value} onChange={onChange} fetchOptions={fetchOptions} error={error} />;
}
