// Le directeur général valide les factures de son pays (périmètre appliqué côté serveur).
const INVOICE_VALIDATOR_ROLES = new Set(['super-admin', 'caissier', 'direction-generale', 'directeur']);

// Rôles qui annulent une facture hors de leur propre production (droit
// `invoices.annuler`). Un commercial annule uniquement ses factures non
// encaissées : ce cas est traité par `canCancelInvoice` ci-dessous.
const INVOICE_CANCELLER_ROLES = new Set([
  'super-admin',
  'direction-generale',
  'responsable-agence',
  'responsable-departement',
]);

export function canValidateInvoices(roleName: string | null | undefined): boolean {
  return INVOICE_VALIDATOR_ROLES.has(roleName ?? '');
}

interface InvoicePermissionUser {
  role?: { name?: string | null } | null;
  permissions?: string[] | null;
}

/** Le droit d'annuler une facture (permission `invoices.annuler`). */
export function canCancelInvoices(user: InvoicePermissionUser | null | undefined): boolean {
  if (!user) return false;

  return INVOICE_CANCELLER_ROLES.has(user.role?.name ?? '') || Boolean(user.permissions?.includes('invoices.annuler'));
}

// Mêmes rôles que `User::COMMERCIAL_ROLES` côté serveur : le commercial
// n'annule que sa facture, et seulement tant que rien n'est encaissé.
const COMMERCIAL_ROLES = new Set(['commercial', 'community-manager']);

interface CancellableInvoice {
  is_cancelled: boolean;
  amount_paid: number | string;
  validation_status: string;
}

/**
 * Une facture est annulable par l'utilisateur courant :
 * - jamais si elle est déjà annulée ;
 * - par les rôles habilités (`invoices.annuler`) quel que soit l'état ;
 * - par un commercial, tant qu'aucun versement n'a été encaissé (la propriété
 *   de la facture est vérifiée par le serveur).
 */
export function canCancelInvoice(
  user: InvoicePermissionUser | null | undefined,
  invoice: CancellableInvoice,
): boolean {
  if (!user || invoice.is_cancelled) return false;

  // Le commercial (et le community-manager) n'annule que ses propres ventes et
  // seulement tant que rien n'est encaissé — même s'il possède la permission
  // `invoices.annuler`. La vérification de propriété reste côté serveur.
  if (COMMERCIAL_ROLES.has(user.role?.name ?? '')) {
    return Number(invoice.amount_paid) <= 0;
  }

  return canCancelInvoices(user);
}
