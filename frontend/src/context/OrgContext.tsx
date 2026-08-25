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

      // Auto-select first available if nothing selected
      setSelectionState((prev) => {
        let next = { ...prev };
        const firstCountry = res.countries[0];
        if (!next.countryId && firstCountry) next.countryId = firstCountry.id;

        const country = res.countries.find((c) => c.id === next.countryId);
        const firstAgency = country?.agencies[0];
        if (!next.agencyId && firstAgency) next.agencyId = firstAgency.id;

        const agency = country?.agencies.find((a) => a.id === next.agencyId);
        const firstDept = agency?.departments[0];
        if (!next.departmentId && firstDept) next.departmentId = firstDept.id;

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
      const next = { ...prev, ...patch };
      // When country changes, reset agency and department
      if (patch.countryId && patch.countryId !== prev.countryId) {
        next.agencyId = null;
        next.departmentId = null;
      }
      // When agency changes, reset department
      if (patch.agencyId && patch.agencyId !== prev.agencyId) {
        next.departmentId = null;
      }
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
