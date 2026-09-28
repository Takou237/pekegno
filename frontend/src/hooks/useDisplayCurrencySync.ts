import { useLocation } from 'react-router-dom';
import i18n from '@/i18n';
import { useOrgContext } from '@/context/OrgContext';
import type { ScopeCountry } from '@/api/scope.api';
import { currencyLabel, setDisplayCurrency } from '@/utils/number';

function countryFromPath(pathname: string, countries: ScopeCountry[]): ScopeCountry | null {
  const countryId = pathname.match(/^\/countries\/([^/]+)/)?.[1];
  if (countryId) return countries.find((c) => c.id === countryId) ?? null;

  const agencyId = pathname.match(/^\/agencies\/([^/]+)/)?.[1];
  if (agencyId) return countries.find((c) => c.agencies.some((a) => a.id === agencyId)) ?? null;

  const departmentId = pathname.match(/^\/departments\/([^/]+)/)?.[1];
  if (departmentId) {
    return countries.find((c) => c.agencies.some((a) => a.departments.some((d) => d.id === departmentId))) ?? null;
  }

  return null;
}

/**
 * Aligne la monnaie d'affichage (formatCurrency, libellés « {{currency}} »)
 * sur le périmètre consulté : pays de la page courante, sinon le seul pays
 * accessible, sinon la monnaie du groupe PEKEGNO (vue multi-pays).
 *
 * Appelé pendant le rendu d'un parent de toutes les pages protégées, pour que
 * les enfants rendus juste après utilisent déjà la bonne monnaie.
 */
export function useDisplayCurrencySync(): void {
  const { pathname } = useLocation();
  const { countries, groupCurrency } = useOrgContext();

  const country = countryFromPath(pathname, countries) ?? (countries.length === 1 ? countries[0] : null);
  const code = country?.currency_code || groupCurrency;

  setDisplayCurrency(code);
  const interpolation = (i18n.options.interpolation ??= {});
  interpolation.defaultVariables = { ...interpolation.defaultVariables, currency: currencyLabel(code) };
}
