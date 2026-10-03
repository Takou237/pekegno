import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RefreshCw, RotateCcw, XOctagon } from 'lucide-react';
import { contractsApi } from '@/api/contracts.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { canManageContracts } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ReasonModal } from '@/components/agencyDept/ReasonModal';
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, type Contract } from '@/types/contract';

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

/**
 * Renouvellements (§8.1) : contrats à renouveler (J-30/15/7/1, D8) et expirés,
 * packages comme prestations. Les alertes partent au chef d'agence et au client (D14).
 */
export default function RenewalsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { departmentId, basePath } = useAgencyDept();
  const [contracts, setContracts] = useState<Contract[] | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<Contract | null>(null);

  const load = useCallback(() => {
    contractsApi
      .list({ department_id: departmentId, status: 'due_soon,expired', per_page: 100 })
      .then((res) => setContracts([...res.data].sort((a, b) => a.end_date.localeCompare(b.end_date))))
      .catch(() => setContracts([]));
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function renew(c: Contract) {
    try {
      await contractsApi.renew(c.id);
      showToast(t('agencyDept.contracts.renewed'), 'success');
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  async function terminate(reason: string) {
    if (!terminateTarget) return;
    try {
      await contractsApi.terminate(terminateTarget.id, reason);
      setTerminateTarget(null);
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.renewals')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.renewals.subtitle')}</p>
        </div>
        <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!contracts ? (
          <SkeletonTable />
        ) : contracts.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.renewals.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.client')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.contracts.object')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.amount')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.endDate')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.renewals.urgency')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {contracts.map((c) => {
                  const days = daysUntil(c.end_date);
                  const tone = days < 0 ? 'text-red-600' : days <= 7 ? 'text-orange-600' : 'text-gray-600 dark:text-gray-300';
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3"><Link to={`${basePath}/contracts/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.number}</Link></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.client ? `${c.client.first_name} ${c.client.last_name}` : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.pack?.name ?? c.prestation?.name ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatCurrency(c.amount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{c.end_date.slice(0, 10)}</td>
                      <td className={`px-4 py-3 whitespace-nowrap font-medium ${tone}`}>
                        {days < 0 && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                        {days < 0 ? t('agencyDept.renewals.overdue', { days: Math.abs(days) }) : t('agencyDept.renewals.inDays', { days })}
                      </td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span></td>
                      <td className="px-4 py-3">
                        {canManageContracts(user) && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => renew(c)} title={t('agencyDept.contracts.renew')}><RotateCcw className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => setTerminateTarget(c)} title={t('agencyDept.contracts.terminate')}><XOctagon className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReasonModal isOpen={!!terminateTarget} title={t('agencyDept.contracts.terminate')} onClose={() => setTerminateTarget(null)} onConfirm={terminate} />
    </div>
  );
}
