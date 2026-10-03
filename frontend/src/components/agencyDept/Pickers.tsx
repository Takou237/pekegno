import { useTranslation } from 'react-i18next';
import { Autocomplete, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { usersApi } from '@/api/users.api';

interface PickerProps {
  label?: string;
  value: string;
  onChange: (id: string) => void;
  error?: string;
  agencyId?: string;
}

/** Sélection d'un client (compte `client`) par recherche. */
export function ClientPicker({ label, value, onChange, error }: PickerProps) {
  const { t } = useTranslation();
  const fetchOptions = async (q: string): Promise<AutocompleteOption[]> => {
    const rows = await clientsApi.search(q);
    return rows.map((c) => ({ id: c.id, label: c.name || [c.first_name, c.last_name].filter(Boolean).join(' '), subtitle: c.email }));
  };
  return <Autocomplete label={label ?? t('agencyDept.client')} value={value} onChange={onChange} fetchOptions={fetchOptions} error={error} />;
}

/** Sélection du commercial vendeur. */
export function CommercialPicker({ label, value, onChange, error }: PickerProps) {
  const { t } = useTranslation();
  const fetchOptions = async (q: string): Promise<AutocompleteOption[]> => {
    const rows = await commercialsApi.search(q);
    return rows.map((c) => ({ id: c.id, label: `${c.first_name} ${c.last_name}`, subtitle: c.email ?? undefined }));
  };
  return <Autocomplete label={label ?? t('agencyDept.commercial')} value={value} onChange={onChange} fetchOptions={fetchOptions} error={error} />;
}

/** Sélection d'un employé (membre d'équipe, assigné d'une action). */
export function EmployeePicker({ label, value, onChange, error, agencyId }: PickerProps) {
  const { t } = useTranslation();
  const fetchOptions = async (q: string): Promise<AutocompleteOption[]> => {
    const res = await usersApi.list({ search: q, agency_id: agencyId, per_page: 10 });
    return res.data
      .filter((u) => u.role?.name !== 'client')
      .map((u) => ({ id: u.id, label: u.name || [u.first_name, u.last_name].filter(Boolean).join(' '), subtitle: u.role?.name ?? u.email }));
  };
  return <Autocomplete label={label ?? t('agencyDept.employee')} value={value} onChange={onChange} fetchOptions={fetchOptions} error={error} />;
}
