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

/** Décalage (ms) du fuseau `timeZone` par rapport à UTC à l'instant `date`. */
function timeZoneOffsetMs(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return asUtc - (date.getTime() - date.getMilliseconds());
}

/**
 * Instant UTC d'une opération datée par un champ « date » seul : on combine le
 * jour choisi avec l'heure courante du fuseau métier (Africa/Douala). Sans cela,
 * une date seule ("2026-10-16") est stockée à minuit UTC et s'affiche à 01h00
 * en heure de Douala alors que l'opération a bien eu lieu « maintenant ».
 */
export function businessInstantForDay(day: string, now: Date = new Date()): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!parts) return new Date(day).toISOString();
  const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => Number(clock.find((p) => p.type === type)?.value ?? 0);
  const wallAsUtc = Date.UTC(
    Number(parts[1]),
    Number(parts[2]) - 1,
    Number(parts[3]),
    get('hour') % 24,
    get('minute'),
    get('second'),
  );
  return new Date(wallAsUtc - timeZoneOffsetMs(BUSINESS_TIMEZONE, now)).toISOString();
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

/**
 * Date + heure à la française : "15/10/2026 à 10h30".
 * - une date sans heure ("2026-10-15") reste en "15/10/2026" (pas de 00h00 artificiel) ;
 * - un instantané est affiché dans le fuseau métier Africa/Douala (aligné backend) ;
 * - "—" si la valeur est absente ou illisible.
 */
export function formatDateTimeFr(value: string | Date | null | undefined): string {
  if (!value) return '—';

  if (typeof value === 'string') {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  const day = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BUSINESS_TIMEZONE,
  }).format(date);

  return `${day} à ${time.replace(':', 'h')}`;
}
