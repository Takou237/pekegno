import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOrgContext } from '@/context/OrgContext';
import { scopeApi, type AgencyOption } from '@/api/scope.api';
import { Select } from '@/components/ui/Select';

/**
 * Sélecteur d'agence.
 *
 * Par défaut, la liste est DÉRIVÉE du contexte organisationnel (OrgContext) :
 * elle reste synchronisée en permanence avec le périmètre de l'utilisateur.
 *
 * Avec `allAgencies`, elle propose TOUTES les agences de Pekegno (tous pays).
 * C'est nécessaire pour une vente/inscription inter-pays : un commercial
 * camerounais doit pouvoir choisir une agence ivoirienne pour y rattacher la
 * vente (le CA est alors attribué à cette agence).
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
  allAgencies = false,
  readOnly = false,
}: {
  value: string;
  onChange: (agencyId: string) => void;
  className?: string;
  label?: string;
  required?: boolean;
  error?: string;
  allAgencies?: boolean;
  /** Agence imposée : affichée en texte fixe, sans liste déroulante. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const { countries } = useOrgContext();
  const [all, setAll] = useState<AgencyOption[] | null>(null);

  useEffect(() => {
    if (!allAgencies) {
      setAll(null);
      return;
    }
    let active = true;
    scopeApi
      .agencies()
      .then((rows) => {
        if (active) setAll(rows);
      })
      .catch(() => {
        if (active) setAll([]);
      });
    return () => {
      active = false;
    };
  }, [allAgencies]);

  const agencies = useMemo(() => {
    if (allAgencies) {
      return (all ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        countryName: a.country_name ?? '',
      }));
    }

    return countries.flatMap((c) =>
      c.agencies.map((a) => ({ id: a.id, name: a.name, countryName: c.name })),
    );
  }, [allAgencies, all, countries]);

  if (readOnly) {
    const current = agencies.find((a) => a.id === value);
    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label ?? t('services.selectAgency')}</span>
        <p className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          {current ? (current.countryName ? `${current.name} — ${current.countryName}` : current.name) : '…'}
        </p>
      </div>
    );
  }

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
