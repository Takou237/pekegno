import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { invoicesApi, type InvoiceIndexResponse } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';

/** Créances Agency (§6.10) : factures de contrats non soldées du département. */
export default function AgencyDeptReceivablesPage() {
  const { t } = useTranslation();
  const { agencyId, departmentId } = useAgencyDept();
  const [result, setResult] = useState<InvoiceIndexResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    if (!departmentId) return;
    invoicesApi
      .list({ agency_id: agencyId, from_contracts: true, contract_department_id: departmentId, status: 'unpaid,partial', page, per_page: 20 })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [agencyId, departmentId, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = result?.invoices.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.receivables')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.receivables.subtitle')}</p>
      </div>
      {result && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs uppercase text-gray-400">{t('agencyDept.receivables.total')}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{formatCurrency(result.totals?.outstanding ?? 0)}</p>
        </div>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.receivables.empty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">N°</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.client')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.total')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.paid')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3"><Link to={`/invoices/${inv.id}`} className="font-medium text-brand-600 hover:underline">{inv.number}</Link></td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? inv.client_name ?? '—'}</td>
                  <td className="px-4 py-3">{formatCurrency(inv.total_amount)}</td>
                  <td className="px-4 py-3">{formatCurrency(inv.amount_paid)}</td>
                  <td className="px-4 py-3 font-medium text-red-600">{formatCurrency(inv.balance_due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {result && result.invoices.meta.last_page > 1 && (
        <Pagination currentPage={result.invoices.meta.current_page} lastPage={result.invoices.meta.last_page} total={result.invoices.meta.total} perPage={result.invoices.meta.per_page} onPageChange={setPage} />
      )}
    </div>
  );
}
