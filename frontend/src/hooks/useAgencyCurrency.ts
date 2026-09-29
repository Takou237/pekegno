import { useOrgContext } from '@/context/OrgContext';
import { getDisplayCurrency } from '@/utils/number';

/**
 * Monnaie d'une agence (celle de son pays). Sert aux formulaires de vente, où
 * l'agence choisie — pas la page consultée — détermine la monnaie facturée.
 */
export function useAgencyCurrency(agencyId?: string | null): string {
  const { countries } = useOrgContext();
  if (!agencyId) return getDisplayCurrency();
  const country = countries.find((c) => c.agencies.some((a) => a.id === agencyId));
  return country?.currency_code || getDisplayCurrency();
}
