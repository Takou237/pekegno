// Le directeur général valide les factures de son pays (périmètre appliqué côté serveur).
const INVOICE_VALIDATOR_ROLES = new Set(['super-admin', 'caissier', 'direction-generale']);

export function canValidateInvoices(roleName: string | null | undefined): boolean {
  return INVOICE_VALIDATOR_ROLES.has(roleName ?? '');
}
