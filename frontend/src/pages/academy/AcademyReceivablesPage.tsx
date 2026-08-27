import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import type { Invoice } from '@/types/invoice';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

export default function AcademyReceivablesPage() {
  const { t } = useTranslation();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await invoicesApi.list({
        agency_id: agencyId || undefined,
        status: 'unpaid',
        search: search || undefined,
        page,
        per_page: 15,
      });
      setInvoices(response.invoices.data);
      setMeta(response.invoices.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('common.error')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, search, page, t]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  function balance(inv: Invoice): number {
    return parseFloat(inv.total_amount) - parseFloat(inv.amount_paid);
  }

  function statusBadge(status: Invoice['status']) {
    if (status === 'paid') return <Badge variant="success">{t('invoices.statusPaid')}</Badge>;
    if (status === 'partial') return <Badge variant="warning">{t('invoices.statusPartial')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('invoices.statusCancelled')}</Badge>;
    return <Badge variant="error">{t('invoices.statusUnpaid')}</Badge>;
  }

  const totalReceivable = invoices.reduce((sum, inv) => sum + balance(inv), 0);

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('common.search')}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : invoices.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noReceivables')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                <th className="px-5 py-3 font-medium">{t('invoices.colTotal')}</th>
                <th className="px-5 py-3 font-medium">{t('invoices.colAdvance')}</th>
                <th className="px-5 py-3 font-medium">{t('academy.balance')}</th>
                <th className="px-5 py-3 font-medium">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-brand-600">{inv.number}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{inv.client_name ?? inv.client_label ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{inv.invoice_date}</td>
                  <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">{formatCurrency(inv.total_amount)}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatCurrency(inv.amount_paid)}</td>
                  <td className="px-5 py-3 font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(balance(inv))}</td>
                  <td className="px-5 py-3">{statusBadge(inv.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={15} onPageChange={setPage} />
      )}
    </div>
  );
}
