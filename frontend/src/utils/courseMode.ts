import type { useTranslation } from 'react-i18next';
import type { Course } from '@/api/academy.api';

type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Libellé lisible du type de formation. La valeur par défaut de la colonne
 * `courses.mode` est `in_person`, et c'est aussi le repli pour les anciennes
 * lignes porteuses d'une valeur hors nomenclature.
 */
export function courseModeLabel(mode: Course['mode'] | null | undefined, t: Translate): string {
  switch (mode) {
    case 'online':
      return t('academy.modeOnline');
    case 'mixed':
      return t('academy.modeMixed');
    default:
      return t('academy.modeInPerson');
  }
}

/** Une formation « en ligne » n'a pas forcément de session : elle reste donc inscriptible sans. */
export function isOnlineCourse(mode: Course['mode'] | null | undefined): boolean {
  return mode === 'online';
}

/**
 * Étiquette d'une formation dans un menu déroulant : « Nom — Type · Prix ».
 * Le type est indispensable ici : présentiel et en ligne se tarifent et
 * s'organisent différemment, et un même nom peut coexister dans les deux modes.
 */
export function courseOptionLabel(course: Course, t: Translate): string {
  const price = course.effective_price ?? course.price;
  const priceLabel = price != null ? `${Number(price).toLocaleString()} FCFA` : course.code;
  return `${course.name} — ${courseModeLabel(course.mode, t)} · ${priceLabel}`;
}
