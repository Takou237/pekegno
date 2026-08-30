import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { scopeApi, type ScopeCountry, type ScopeAgency, type ScopeDepartment, type ContextSelection } from '@/api/scope.api';

const STORAGE_KEY = 'pekegno_context';

export interface OrgContextState {
  countries: ScopeCountry[];
  selectedCountry: ScopeCountry | null;
  selectedAgency: ScopeAgency | null;
  selectedDepartment: ScopeDepartment | null;
  selection: ContextSelection;
  loading: boolean;
  error: string | null;
  setSelection: (sel: Partial<ContextSelection>) => void;
  refresh: () => Promise<void>;
}

const OrgContext = createContext<OrgContextState | null>(null);

function loadPersistedSelection(): ContextSelection {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { countryId: null, agencyId: null, departmentId: null };
}

function persistSelection(sel: ContextSelection) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [countries, setCountries] = useState<ScopeCountry[]>([]);
  const [selection, setSelectionState] = useState<ContextSelection>(loadPersistedSelection);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await scopeApi.getContext();
      setCountries(res.countries);

      // Répare la sélection persistée contre le référentiel frais : tout id de
      // pays/agence/département qui n'existe plus (ex. après une réinitialisation
      // de la base) est retiré et remplacé par la première option disponible.
      // La barre d'accès rapide ne pointe donc plus vers des entités disparues.
      setSelectionState((prev) => {
        let next = { ...prev };

        const firstCountry = res.countries[0];
        const country = res.countries.find((c) => c.id === next.countryId);
        if (!country) {
          next.countryId = firstCountry?.id ?? null;
        }
        const sourceCountry = country ?? firstCountry;

        const agencies = sourceCountry?.agencies ?? [];
        const agency = agencies.find((a) => a.id === next.agencyId);
        if (!agency) {
          next.agencyId = agencies[0]?.id ?? null;
        }
        const sourceAgency = agency ?? agencies[0];

        const departments = sourceAgency?.departments ?? [];
        const department = departments.find((d) => d.id === next.departmentId);
        if (!department) {
          next.departmentId = departments[0]?.id ?? null;
        }

        persistSelection(next);
        return next;
      });
    } catch {
      setError('Impossible de charger le contexte organisationnel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContext();
  }, [fetchContext]);

  const setSelection = useCallback((patch: Partial<ContextSelection>) => {
    setSelectionState((prev) => {
      let next = { ...prev, ...patch };

      // When country changes, reset agency/department — unless they were provided explicitly.
      if (patch.countryId !== undefined && patch.countryId !== prev.countryId) {
        if (patch.agencyId === undefined) next.agencyId = null;
        if (patch.departmentId === undefined) next.departmentId = null;
      }
      // When agency changes, reset department — unless it was provided explicitly.
      if (patch.agencyId !== undefined && patch.agencyId !== prev.agencyId) {
        if (patch.departmentId === undefined) next.departmentId = null;
      }

      const unchanged =
        next.countryId === prev.countryId &&
        next.agencyId === prev.agencyId &&
        next.departmentId === prev.departmentId;
      if (unchanged) return prev;

      persistSelection(next);
      return next;
    });
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((c) => c.id === selection.countryId) ?? null,
    [countries, selection.countryId],
  );
  const selectedAgency = useMemo(
    () => selectedCountry?.agencies.find((a) => a.id === selection.agencyId) ?? null,
    [selectedCountry, selection.agencyId],
  );
  const selectedDepartment = useMemo(
    () => selectedAgency?.departments.find((d) => d.id === selection.departmentId) ?? null,
    [selectedAgency, selection.departmentId],
  );

  const value: OrgContextState = useMemo(
    () => ({
      countries,
      selectedCountry,
      selectedAgency,
      selectedDepartment,
      selection,
      loading,
      error,
      setSelection,
      refresh: fetchContext,
    }),
    [countries, selectedCountry, selectedAgency, selectedDepartment, selection, loading, error, setSelection, fetchContext],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrgContext(): OrgContextState {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrgContext must be used within OrgProvider');
  return ctx;
}
