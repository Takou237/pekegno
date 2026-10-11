import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrgContext } from '@/context/OrgContext';
import { Select } from '@/components/ui/Select';

/**
 * Sélecteur d'agence dérivé du contexte organisationnel (OrgContext).
 *
 * La liste est DÉRIVÉE directement de `countries` (useMemo) : elle reste
 * synchronisée en permanence avec le périmètre de l'utilisateur — connexion,
 * changement de compte, rafraîchissement du contexte — sans copie d'état
 * stale. C'est la même source que la barre Pays/Agence du header.
 *
 * Libellé « Agence — Pays » pour désambiguïser les agences homonymes
 * (ex. une agence par ville dans plusieurs pays).
 */
export function AgencyScopeSelect({
  value,
  onChange,
  className,
  label,
  required = false,
  error,
}: {
  value: string;
  onChange: (agencyId: string) => void;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
}) {
  const { t } = useTranslation();
  const { countries } = useOrgContext();

  const agencies = useMemo(
    () =>
      countries.flatMap((c) =>
        c.agencies.map((a) => ({ id: a.id, name: a.name, countryName: c.name })),
      ),
    [countries],
  );

  return (
    <Select
      label={label ?? t('services.selectAgency')}
      required={required}
      error={error}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{t('services.selectAgencyPlaceholder')}</option>
      {agencies.length === 0 && (
        <option disabled value="">
          {t('services.noAgenciesInScope')}
        </option>
      )}
      {agencies.map((a) => (
        <option key={`${a.countryName}-${a.id}`} value={a.id}>
          {a.countryName ? `${a.name} — ${a.countryName}` : a.name}
        </option>
      ))}
    </Select>
  );
}
