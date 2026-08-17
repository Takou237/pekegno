import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { commercialsApi } from '@/api/commercials.api';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Checkbox } from '@/components/ui/Checkbox';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { Commercial } from '@/types/commercial';

export interface CommercialFormValues {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  user_id: string;
  agency_id: string;
  commission_type: 'none' | 'percent' | 'fixed';
  commission_value: string;
  is_active: boolean;
}

export function commercialFormFrom(
  commercial: Commercial | null,
  fixedAgencyId?: string
): CommercialFormValues {
  return {
    first_name: commercial?.first_name ?? '',
    last_name: commercial?.last_name ?? '',
    email: commercial?.email ?? '',
    phone: commercial?.phone ?? '',
    user_id: commercial?.user_id ?? '',
    agency_id: commercial?.agency_id ?? fixedAgencyId ?? '',
    commission_type: commercial?.commission_type ?? 'none',
    commission_value: commercial?.commission_value ?? '',
    is_active: commercial?.is_active ?? true,
  };
}

export function CommercialForm({
  value,
  onChange,
  errors = {},
  linkedUserLabel = '',
  fixedAgencyId,
}: {
  value: CommercialFormValues;
  onChange: (next: CommercialFormValues) => void;
  errors?: Record<string, string>;
  linkedUserLabel?: string;
  fixedAgencyId?: string;
}) {
  const { t } = useTranslation();
  const [availableUsers, setAvailableUsers] = useState<{ id: string; label: string; subtitle: string }[]>([]);

  function set<K extends keyof CommercialFormValues>(key: K, v: CommercialFormValues[K]) {
    onChange({ ...value, [key]: v });
  }

  const agencyOptions = async (query: string) => {
    const res = await agenciesApi.list({ search: query.trim() || undefined, per_page: 20 });
    return res.data.map((a) => ({
      id: a.id,
      label: a.name,
      subtitle: [a.code, a.city].filter(Boolean).join(' — '),
    }));
  };

  const userOptions = async (query: string) => {
    if (availableUsers.length === 0) {
      const users = await commercialsApi.availableUsers();
      setAvailableUsers(
        users.map((u) => ({
          id: u.id,
          label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
          subtitle: u.email,
        }))
      );
    }
    const q = query.toLowerCase();
    const current: { id: string; label: string; subtitle?: string }[] = linkedUserLabel
      ? [{ id: value.user_id, label: linkedUserLabel }]
      : [];
    return [
      ...current.filter((u) => u.label.toLowerCase().includes(q)),
      ...availableUsers.filter(
        (u) => u.label.toLowerCase().includes(q) || u.subtitle.toLowerCase().includes(q)
      ),
    ].slice(0, 20);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('commercials.firstName')}
          name="first_name"
          required
          value={value.first_name}
          onChange={(e) => set('first_name', e.target.value)}
          error={errors.first_name}
        />
        <Input
          label={t('commercials.lastName')}
          name="last_name"
          required
          value={value.last_name}
          onChange={(e) => set('last_name', e.target.value)}
          error={errors.last_name}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t('commercials.email')}
          type="email"
          name="email"
          value={value.email}
          onChange={(e) => set('email', e.target.value)}
          error={errors.email}
        />
        <Input
          label={t('commercials.phone')}
          type="tel"
          name="phone"
          value={value.phone}
          onChange={(e) => set('phone', e.target.value)}
          error={errors.phone}
          placeholder="+237 6XX XXX XXX"
        />
      </div>

      <Autocomplete
        label={t('commercials.agency')}
        placeholder={t('commercials.agencyPlaceholder')}
        value={fixedAgencyId ?? value.agency_id}
        onChange={(agencyId) => {
          if (!fixedAgencyId) set('agency_id', agencyId);
        }}
        fetchOptions={agencyOptions}
        error={errors.agency_id}
        disabled={Boolean(fixedAgencyId)}
      />

      <Autocomplete
        label={t('commercials.linkUser')}
        placeholder={t('commercials.linkUserPlaceholder')}
        value={value.user_id}
        onChange={(userId) => set('user_id', userId)}
        fetchOptions={userOptions}
        error={errors.user_id}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Select
          label={t('commercials.commission')}
          value={value.commission_type}
          onChange={(e) =>
            set('commission_type', e.target.value as 'none' | 'percent' | 'fixed')
          }
        >
          <option value="none">{t('commercials.commissionNone')}</option>
          <option value="percent">{t('commercials.commissionPercent')}</option>
          <option value="fixed">{t('commercials.commissionTypeFixed')}</option>
        </Select>
        <Input
          label={t('commercials.commissionValue')}
          type="number"
          min={0}
          step="0.01"
          name="commission_value"
          value={value.commission_value}
          onChange={(e) => set('commission_value', e.target.value)}
          disabled={value.commission_type === 'none'}
          error={errors.commission_value}
          hint={t('commercials.commissionValueHint')}
        />
      </div>

      <Checkbox
        label={t('commercials.isActive')}
        checked={value.is_active}
        onChange={(e) => set('is_active', e.target.checked)}
      />
    </div>
  );
}
