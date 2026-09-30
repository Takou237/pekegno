import { businessToday, todayLocal } from '@/utils/date';

export interface Period {
  from: string;
  to: string;
}

export type PeriodPresetKey =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30Days'
  | 'thisYear';

function shift(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Lundi de la semaine de `date` (semaine ISO, usage FR). */
function monday(date: Date): Date {
  return shift(date, -((date.getDay() + 6) % 7));
}

/**
 * Bornes YYYY-MM-DD calculées sur le jour métier Africa/Douala (jamais
 * `toISOString()` : UTC décalait d'un jour en Afrique centrale, « Ce mois »
 * partait du 31 du mois précédent). Le jour métier sert de base au calcul,
 * les bornes sont rendues en dates locales pour rester lisibles.
 */
export function presetPeriod(key: PeriodPresetKey, now: Date = new Date()): Period {
  const today = businessToday(now);
  const base = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10)));
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = todayLocal(shift(base, -1));
      return { from: y, to: y };
    }
    case 'thisWeek':
      return { from: todayLocal(monday(base)), to: today };
    case 'lastWeek': {
      const start = shift(monday(base), -7);
      return { from: todayLocal(start), to: todayLocal(shift(start, 6)) };
    }
    case 'thisMonth':
      return { from: todayLocal(new Date(base.getFullYear(), base.getMonth(), 1)), to: today };
    case 'lastMonth':
      return {
        from: todayLocal(new Date(base.getFullYear(), base.getMonth() - 1, 1)),
        to: todayLocal(new Date(base.getFullYear(), base.getMonth(), 0)),
      };
    case 'last30Days':
      return { from: todayLocal(shift(base, -29)), to: today };
    case 'thisYear':
      return { from: todayLocal(new Date(base.getFullYear(), 0, 1)), to: today };
  }
}

export const PERIOD_PRESETS: { key: PeriodPresetKey; labelKey: string }[] = [
  { key: 'today', labelKey: 'dashboard.presetToday' },
  { key: 'yesterday', labelKey: 'dashboard.presetYesterday' },
  { key: 'thisWeek', labelKey: 'dashboard.presetThisWeek' },
  { key: 'lastWeek', labelKey: 'dashboard.presetLastWeek' },
  { key: 'thisMonth', labelKey: 'dashboard.presetThisMonth' },
  { key: 'lastMonth', labelKey: 'dashboard.presetLastMonth' },
  { key: 'last30Days', labelKey: 'dashboard.presetLast30Days' },
  { key: 'thisYear', labelKey: 'dashboard.presetThisYear' },
];
