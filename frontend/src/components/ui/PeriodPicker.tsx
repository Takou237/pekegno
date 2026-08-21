import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';

export interface Period {
  from: string;
  to: string;
}

/** Période par défaut : du 1er du mois courant à aujourd'hui. */
export function defaultPeriod(): Period {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

interface PeriodPickerProps {
  value: Period;
  onChange: (period: Period) => void;
}

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const { t } = useTranslation();

  function preset(build: () => Period) {
    onChange(build());
  }

  const presets: { label: string; build: () => Period }[] = [
    {
      label: t('dashboard.presetThisMonth'),
      build: () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        };
      },
    },
    {
      label: t('dashboard.presetLastMonth'),
      build: () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const last = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
          from: first.toISOString().slice(0, 10),
          to: last.toISOString().slice(0, 10),
        };
      },
    },
    {
      label: t('dashboard.presetLast30Days'),
      build: () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        return {
          from: start.toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        };
      },
    },
    {
      label: t('dashboard.presetThisYear'),
      build: () => {
        const now = new Date();
        return {
          from: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10),
          to: now.toISOString().slice(0, 10),
        };
      },
    },
  ];

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
      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => preset(p.build)}
            className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
