import type { EnrollmentDiscountType } from '@/types/formation';

/**
 * Remise accordée sur une inscription : en pourcentage ou en montant fixe.
 * Les deux formulaires d'inscription (modale et page liste) partagent ce calcul.
 */
export interface EnrollmentDiscountInput {
  discount_type: '' | EnrollmentDiscountType;
  discount_value: string;
}

/** Prix catalogue retenu pour la formation (promotion comprise, côté backend). */
export function courseBasePrice(course: { price?: number | null; effective_price?: number | null } | null): number {
  if (!course) return 0;
  return Number(course.effective_price ?? course.price ?? 0) || 0;
}

/**
 * Remise résolue en montant, plafonnée au prix de la formation : au-delà,
 * la facture deviendrait négative. La même règle est appliquée côté backend.
 */
export function resolveEnrollmentDiscount(price: number, input: EnrollmentDiscountInput): number {
  const value = Number(input.discount_value);
  if (!input.discount_type || !Number.isFinite(value) || value <= 0) return 0;

  const amount = input.discount_type === 'percent' ? (price * value) / 100 : value;
  if (amount <= 0) return 0;

  return Math.min(Math.round(amount * 100) / 100, price);
}
