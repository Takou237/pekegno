import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useOrgContext } from '@/context/OrgContext';

export function GeoFilters({
  countryId,
  agencyId,
  onCountry,
  onAgency,
}: {
  countryId: string;
  agencyId: string;
  onCountry: (value: string) => void;
  onAgency: (value: string) => void;
}) {
  const { t } = useTranslation();
  const { countries } = useOrgContext();

  const agencies = useMemo(() => {
    if (!countryId) return [];
    return countries.find((c) => c.id === countryId)?.agencies ?? [];
  }, [countryId, countries]);

  return (
    <>
      <div className="w-full sm:w-56">
        <Select
          label={t('reports.filterCountry')}
          value={countryId}
          onChange={(e) => {
            onCountry(e.target.value);
            onAgency('');
          }}
        >
          <option value="">{t('dashboard.allCountries')}</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>
      <div className="w-full sm:w-56">
        <Select
          label={t('reports.filterAgency')}
          value={agencyId}
          onChange={(e) => onAgency(e.target.value)}
          disabled={!countryId}
        >
          <option value="">{t('dashboard.allAgencies')}</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>
      </div>
    </>
  );
}

export function ReportFilters({
  from,
  to,
  onFrom,
  onTo,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
      <div className="w-full sm:w-44">
        <Input label={t('reports.from')} type="date" value={from} onChange={(e) => onFrom(e.target.value)} />
      </div>
      <div className="w-full sm:w-44">
        <Input label={t('reports.to')} type="date" value={to} onChange={(e) => onTo(e.target.value)} />
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  green: 'bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400',
};

export function ReportStatCard({
  icon: Icon,
  label,
  value,
  tone = 'brand',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function ReportBar({ value, max, tone = 'bg-brand-500' }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
    </div>
  );
}