const INVOICE_VALIDATOR_ROLES = new Set(['super-admin', 'caissier']);

export function canValidateInvoices(roleName: string | null | undefined): boolean {
  return INVOICE_VALIDATOR_ROLES.has(roleName ?? '');
}
