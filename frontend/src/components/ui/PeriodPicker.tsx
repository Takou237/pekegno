import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';

import { PeriodPresets } from '@/components/ui/PeriodPresets';
import { presetPeriod, type Period } from '@/utils/period';

export type { Period };

/** Période par défaut : du 1er du mois courant à aujourd'hui. */
export function defaultPeriod(): Period {
  return presetPeriod('thisMonth');
}

interface PeriodPickerProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const { t } = useTranslation();

  const inputClass =
    'rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
        <CalendarDays className="h-4 w-4" />
        {t('dashboard.period')}
      </span>
      <input
        type="date"
        aria-label={t('dashboard.periodFrom')}
        value={value.from}
        max={value.to}
        onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
        className={inputClass}
      />
      <span className="text-sm text-gray-400">→</span>
      <input
        type="date"
        aria-label={t('dashboard.periodTo')}
        value={value.to}
        min={value.from}
        onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
        className={inputClass}
      />
      <PeriodPresets from={value.from} to={value.to} onChange={onChange} />
    </div>
  );
}
