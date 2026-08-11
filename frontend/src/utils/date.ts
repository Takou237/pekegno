import i18n, { currentLocale } from '@/i18n';

/**
 * Formate une date à la façon WhatsApp :
 * - aujourd'hui -> "Aujourd'hui"
 * - hier -> "Hier"
 * - moins de 7 jours -> jour de la semaine ("mercredi", "jeudi", ...)
 * - sinon -> jour/mois/année (jj/mm/aaaa)
 */
export function formatRelativeDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
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
