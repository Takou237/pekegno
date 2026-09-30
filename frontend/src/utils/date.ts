import i18n, { currentLocale } from '@/i18n';

/**
 * Fuseau métier : doit rester aligné sur `config('app.business_timezone')`
 * côté backend. Les « journées » comptables (bilan, encaissements) sont closes
 * à minuit heure de Douala, pas à minuit heure du navigateur.
 */
export const BUSINESS_TIMEZONE = 'Africa/Douala';

/**
 * Retourne la date du jour dans le fuseau local de l'utilisateur (YYYY-MM-DD).
 * À utiliser pour les bornes from/to (le backend interprète ces dates dans le
 * fuseau métier Africa/Douala).
 */
export function todayLocal(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Date du jour métier (YYYY-MM-DD en Africa/Douala), alignée sur
 * `App\Support\Period::businessToday()`. Un navigateur hors UTC+0/+1 verrait
 * sinon « aujourd'hui » basculer sur la mauvaise journée.
 */
export function businessToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Convertit un jour `YYYY-MM-DD` en Date à minuit local. `new Date('2026-09-30')`
 * est interprété en UTC par le navigateur et affiche la veille dans les fuseaux
 * à l'ouest de Greenwich.
 */
export function parseDay(value: string | Date): Date {
  if (value instanceof Date) return value;
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (parts) return new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  return new Date(value);
}

/**
 * Formate une date à la façon WhatsApp :
 * - aujourd'hui -> "Aujourd'hui"
 * - hier -> "Hier"
 * - moins de 7 jours -> jour de la semaine ("mercredi", "jeudi", ...)
 * - sinon -> jour/mois/année (jj/mm/aaaa)
 */
export function formatRelativeDate(value: string | Date): string {
  const date = parseDay(value);
  if (Number.isNaN(date.getTime())) return '—';

  const locale = currentLocale();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (dayDiff === 0) return capitalize(i18n.t('date.today'));
  if (dayDiff === 1) return capitalize(i18n.t('date.yesterday'));
  if (dayDiff > 1 && dayDiff < 7) {
    return capitalize(
      new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date)
    );
  }

  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
