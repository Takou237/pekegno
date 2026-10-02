import { Check, Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CountryStat } from '@/types/stats';

interface CountryDeployPickerProps {
  countries: CountryStat[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Pays de l'agence de création, signalé « (pays actuel) ». */
  currentCountryId?: string;
  /** Explication de ce qui sera créé (formation, service…). */
  hint: string;
  error?: string;
}

/**
 * Choix des pays où dupliquer un élément du catalogue à la création : il est
 * créé dans toutes les agences de chaque pays coché (formations, services).
 */
export function CountryDeployPicker({
  countries,
  selectedIds,
  onChange,
  currentCountryId,
  hint,
  error,
}: CountryDeployPickerProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Globe className="h-4 w-4 text-brand-500" />
        {t('academy.deployCountries')}
      </label>
      <p className="-mt-1 text-xs text-gray-400 dark:text-gray-500">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {countries.map((country) => {
          const selected = selectedIds.includes(country.id);
          const isCurrent = currentCountryId === country.id;
          return (
            <button
              key={country.id}
              type="button"
              onClick={() =>
                onChange(selected ? selectedIds.filter((id) => id !== country.id) : [...selectedIds, country.id])
              }
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-500 text-white shadow-sm'
                  : 'border-gray-300 text-gray-600 hover:border-brand-400 dark:border-gray-700 dark:text-gray-300'
              }`}
            >
              {selected && <Check className="h-3.5 w-3.5" />}
              {isCurrent ? t('academy.currentCountry', { country: country.name }) : country.name}
            </button>
          );
        })}
      </div>
      {error && <p className="text-sm text-error-500">{error}</p>}
    </div>
  );
}
