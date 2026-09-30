import { useTranslation } from 'react-i18next';
import { PERIOD_PRESETS, presetPeriod, type Period, type PeriodPresetKey } from '@/utils/period';

interface PeriodPresetsProps {
  from: string;
  to: string;
  onChange: (period: Period) => void;
  /** Ajoute « Tout » (bornes vides) pour les listes sans période par défaut. */
  allowAll?: boolean;
  /** Restreint les raccourcis proposés. */
  only?: PeriodPresetKey[];
  className?: string;
}

/** Raccourcis de période (aujourd'hui, hier, cette semaine, ce mois...). */
export function PeriodPresets({ from, to, onChange, allowAll = false, only, className = '' }: PeriodPresetsProps) {
  const { t } = useTranslation();
  const presets = only ? PERIOD_PRESETS.filter((p) => only.includes(p.key)) : PERIOD_PRESETS;

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
      active
        ? 'border-brand-500 bg-brand-500 text-white'
        : 'border-gray-200 text-gray-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:text-gray-300 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10 dark:hover:text-brand-300'
    }`;

  return (
    <div className={`scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto px-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 ${className}`}>
      {presets.map((p) => {
        const period = presetPeriod(p.key);
        const active = period.from === from && period.to === to;
        return (
          <button key={p.key} type="button" aria-pressed={active} onClick={() => onChange(period)} className={chip(active)}>
            {t(p.labelKey)}
          </button>
        );
      })}
      {allowAll && (
        <button type="button" aria-pressed={!from && !to} onClick={() => onChange({ from: '', to: '' })} className={chip(!from && !to)}>
          {t('dashboard.presetAll')}
        </button>
      )}
    </div>
  );
}
