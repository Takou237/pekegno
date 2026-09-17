import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Search, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import type { Invoice } from '@/types/invoice';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';
import { useOrgContext } from '@/context/OrgContext';

/**
 * Page « Créances » : toutes les factures non soldées (validées, donc entrées en
 * comptabilité) avec leur reste à payer. Pensée pour le caissier (relances et
 * encaissements) mais utilisable par tout rôle autorisé à consulter les factures.
 */
export default function ReceivablesPage() {
  const { t } = useTranslation();
const { countryId } = useParams<{ countryId?: string }>();
  const { countries } = useOrgContext();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [totalReceivable, setTotalReceivable] = useState(0);
  const [search, setSearch] = useState('');
  const [agencyId, setAgencyId] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await invoicesApi.list({
        status: 'unpaid,partial',
        search: search || undefined,
country_id: countryId || undefined,
        agency_id: agencyId || undefined,
        page,
        per_page: 15,
      });
      setInvoices(response.invoices.data);
      setMeta(response.invoices.meta);
      setTotalReceivable(response.totals?.outstanding ?? 0);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('common.error')));
    } finally {
      setIsLoading(false);
    }
}, [search, countryId, agencyId, page, t]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  function balance(inv: Invoice): number {
    return Number(inv.total_amount) - Number(inv.amount_paid);
  }

  function statusBadge(status: Invoice['status']) {
    if (status === 'paid') return <Badge variant="success">{t('invoices.statusPaid')}</Badge>;
    if (status === 'partial') return <Badge variant="warning">{t('invoices.statusPartial')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('invoices.statusCancelled')}</Badge>;
    return <Badge variant="error">{t('invoices.statusUnpaid')}</Badge>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.receivables')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.receivablesSubtitle')}</p>
        </div>
        {totalReceivable > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-xs text-amber-600 dark:text-amber-400">{t('academy.totalReceivable')}</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{formatCurrency(totalReceivable)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder={t('invoices.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <select
          value={agencyId}
          onChange={(e) => {
            setPage(1);
            setAgencyId(e.target.value);
          }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 sm:w-64"
        >
          <option value="">{t('common.selectAllAgencies')}</option>
          {countries.map((country) => (
            <optgroup key={country.id} label={country.name}>
              {country.agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : invoices.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noReceivables')}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                    <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                    <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                    <th className="px-5 py-3 font-medium">{t('invoices.colTotal')}</th>
                    <th className="px-5 py-3 font-medium">{t('invoices.balanceDue')}</th>
                    <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3">
                        <Link
                          to={countryId ? `/countries/${countryId}/invoices/${inv.id}` : `/invoices/${inv.id}`}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(inv.invoice_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatCurrency(Number(inv.total_amount))}</td>
                      <td className="px-5 py-3 font-semibold text-amber-600 dark:text-amber-400">
                        {formatCurrency(balance(inv))}
                      </td>
                      <td className="px-5 py-3">{statusBadge(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && meta.last_page > 1 && (
              <div className="border-t border-gray-100 p-4 dark:border-gray-800">
                <Pagination
                  currentPage={meta.current_page}
                  lastPage={meta.last_page}
                  total={meta.total}
                  perPage={15}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
