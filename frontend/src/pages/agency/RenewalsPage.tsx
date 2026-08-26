import { useCallback, useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { RefreshCw, RotateCcw, XOctagon, Eye, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { contractsApi } from '@/api/contracts.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { SkeletonTable } from '@/components/ui/Skeleton';
import {
  Contract,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
} from '@/types/contract';
import type { Agency } from '@/types/agency';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyBadge(days: number, t: ReturnType<typeof useTranslation>['t']) {
  if (days < -30) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <AlertTriangle className="h-3 w-3" />
        {t('contracts.overdue')} {Math.abs(days)}j
      </span>
    );
  }
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        {t('contracts.overdue')} {Math.abs(days)}j
      </span>
    );
  }
  if (days <= 15) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
        {days}j
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      {days}j
    </span>
  );
}

export default function RenewalsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<AgencyLayoutContext>();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState('');
  const [terminateReason, setTerminateReason] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    contractsApi
      .list({
        agency_id: agencyId || undefined,
        status: 'due_soon',
        per_page: 100,
      })
      .then(async (dueSoonRes) => {
        const expiredRes = await contractsApi.list({
          agency_id: agencyId || undefined,
          status: 'expired',
          per_page: 100,
        });
        const all = [...(dueSoonRes.data ?? []), ...(expiredRes.data ?? [])];
        all.sort((a, b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime());
        setContracts(all);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRenew(id: string) {
    try {
      const res = await contractsApi.renew(id);
      showToast(t('contracts.renewed'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handleTerminate() {
    if (!terminateTarget || !terminateReason.trim()) return;
    try {
      await contractsApi.terminate(terminateTarget, terminateReason);
      showToast(t('contracts.terminated'), 'success');
      setTerminateOpen(false);
      setTerminateReason('');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('contracts.renewals')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('contracts.renewalsSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : contracts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('contracts.noRenewals')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('contracts.number')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.clients')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.endDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.urgency')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {contracts.map((c) => {
                  const days = daysUntil(c.end_date);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{c.number}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {c.client
                          ? [c.client.first_name, c.client.last_name].filter(Boolean).join(' ') || '—'
                          : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                        {new Date(c.end_date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3">{urgencyBadge(days, t)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`/contracts/${c.id}`}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('common.viewDetails')}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleRenew(c.id)}
                            className="rounded p-1 text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                            title={t('contracts.renew')}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setTerminateTarget(c.id); setTerminateOpen(true); }}
                            className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t('contracts.terminate')}
                          >
                            <XOctagon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal isOpen={terminateOpen} onClose={() => setTerminateOpen(false)} title={t('contracts.terminate')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <Input
            label={t('contracts.terminateReason')}
            required
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setTerminateOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleTerminate} disabled={!terminateReason.trim()} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
