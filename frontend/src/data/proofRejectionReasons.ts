/**
 * B25 — motifs de rejet d'une preuve de paiement.
 *
 * Mêmes codes que `App\Support\PaymentProofRejectionReason` côté serveur (source
 * de vérité). Le texte libre reste disponible en précision et devient
 * obligatoire pour « Autre ».
 */
export const PROOF_REJECTION_CODES = [
  'expired_date',
  'wrong_amount',
  'unreadable',
  'wrong_recipient',
  'other',
] as const;

export type ProofRejectionCode = (typeof PROOF_REJECTION_CODES)[number];

/** Clé i18n du libellé de chaque motif. */
export const PROOF_REJECTION_LABEL_KEY: Record<ProofRejectionCode, string> = {
  expired_date: 'invoices.proofRejectExpiredDate',
  wrong_amount: 'invoices.proofRejectWrongAmount',
  unreadable: 'invoices.proofRejectUnreadable',
  wrong_recipient: 'invoices.proofRejectWrongRecipient',
  other: 'invoices.proofRejectOther',
};

/** Motif qui exige une précision écrite. */
export const PROOF_REJECTION_OTHER: ProofRejectionCode = 'other';
