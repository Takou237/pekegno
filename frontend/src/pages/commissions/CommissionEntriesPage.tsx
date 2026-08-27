import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, CheckCircle, Banknote, XCircle } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import type { CommissionEntry, CommissionEntryStatus } from '@/types/commissions';
import type { PaginationMeta } from '@/types/agency';

const STATUS_BADGES: Record<CommissionEntryStatus, string> = {
  calculated: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  validated: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  paid: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function CommissionEntriesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<CommissionEntryStatus | ''>('');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    commissionsApi.listEntries({
      status: filterStatus || undefined,
      page,
      per_page: 15,
    })
      .then((res) => {
        setEntries(res.data);
        setMeta({ current_page: res.current_page, last_page: res.last_page, total: res.total, per_page: res.per_page });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus, page]);

  useEffect(() => { load(); }, [load]);

  async function handleAction(action: 'validate' | 'pay' | 'cancel', id: string) {
    try {
      if (action === 'validate') await commissionsApi.validateEntry(id);
      if (action === 'pay') await commissionsApi.payEntry(id);
      if (action === 'cancel') await commissionsApi.cancelEntry(id);
      showToast(t(`commissions.entry${action.charAt(0).toUpperCase() + action.slice(1)}d`), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commissions.entriesTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissions.entriesSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select
            label={t('commissions.filterByStatus')}
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value as CommissionEntryStatus | ''); setPage(1); }}
          >
            <option value="">{t('common.all')}</option>
            <option value="calculated">{t('commissions.statusCalculated')}</option>
            <option value="validated">{t('commissions.statusValidated')}</option>
            <option value="paid">{t('commissions.statusPaid')}</option>
            <option value="cancelled">{t('commissions.statusCancelled')}</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('commissions.noEntries')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('commissions.invoice')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.beneficiary')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.ruleName')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.baseAmount')}</th>
                  <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.date')}</th>
                  <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                      {entry.invoice?.number ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {entry.beneficiary ? `${entry.beneficiary.first_name} ${entry.beneficiary.last_name}` : '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {(entry.rule_snapshot?.name as string | undefined) ?? entry.rule?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(entry.base_amount)}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[entry.status]}`}>
                        {t(`commissions.status${entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}`)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 text-right font-medium">
                      <span className="text-gray-800 dark:text-gray-100">{formatCurrency(entry.amount)}</span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {entry.status === 'calculated' && (
                          <>
                            <button onClick={() => handleAction('validate', entry.id)} className="rounded p-1 text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20" title={t('commissions.validate')}>
                              <CheckCircle className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleAction('cancel', entry.id)} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('commissions.cancel')}>
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {entry.status === 'validated' && (
                          <button onClick={() => handleAction('pay', entry.id)} className="rounded p-1 text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20" title={t('commissions.pay')}>
                            <Banknote className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
