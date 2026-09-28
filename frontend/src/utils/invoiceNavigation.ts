/**
 * Navigation contextuelle des factures.
 *
 * Les listes de factures portent leurs filtres (et leur page) dans l'URL :
 * ouvrir une facture puis revenir doit donc ramener exactement là où l'on
 * était, sinon le retour retombe sur une liste vierge — depuis un pays, une
 * agence ou un écran d'encaissement, c'est une page sans rapport avec le
 * travail en cours. Ces helpers mémorisent l'origine (`state.from`) et la
 * restituent au retour.
 */

/** Filtres repris sur un chemin de retour (l'ordre suit la barre de filtres). */
const LIST_FILTERS = [
  'status',
  'agency_id',
  'client_id',
  'commercial_id',
  'from',
  'to',
  'page',
] as const;

export interface NavOrigin {
  from?: string;
}

/** Liste des factures : globale, ou scopée à une agence. */
export function invoiceListPath(agencyId?: string): string {
  return agencyId ? `/agencies/${agencyId}/invoices` : '/invoices';
}

/**
 * Liste par défaut d'un détail de facture, déduite de l'URL courante :
 * `/countries/:id/invoices/:invoiceId` → `/countries/:id/invoices`. Évite
 * d'envoyer une facture ouverte depuis un pays vers la liste globale.
 */
export function invoiceListPathForDetail(pathname: string, agencyId?: string): string {
  const match = /^(.*\/invoices)\/[^/]+\/?$/.exec(pathname);
  return match?.[1] ?? invoiceListPath(agencyId);
}

/** Reprend les filtres d'une liste sur un chemin de retour. */
export function withInvoiceFilters(path: string, search: URLSearchParams | string): string {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const kept = new URLSearchParams();
  for (const key of LIST_FILTERS) {
    const value = params.get(key);
    if (value) kept.set(key, value);
  }
  const query = kept.toString();
  return query ? `${path}?${query}` : path;
}

/** Origine à mémoriser en navigation : le chemin de liste et ses filtres courants. */
export function invoiceOrigin(listPath: string, search: URLSearchParams | string): NavOrigin {
  return { from: withInvoiceFilters(listPath, search) };
}

/**
 * Chemin de retour : l'origine mémorisée si elle est interne, sinon la liste
 * de repli avec les filtres présents dans l'URL. Seuls les chemins relatifs
 * sont acceptés, pour ne jamais suivre une origineconstruite ailleurs.
 */
export function invoiceBackPath(
  state: unknown,
  fallback: string,
  search: URLSearchParams | string = '',
): string {
  const from = (state as NavOrigin | null)?.from;
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  return withInvoiceFilters(fallback, search);
}
