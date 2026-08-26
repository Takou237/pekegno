import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, RotateCcw, XOctagon, Pause } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { contractsApi } from '@/api/contracts.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import {
  Contract,
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  BILLING_CYCLE_LABELS,
} from '@/types/contract';

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [contract, setContract] = useState<Contract | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    contractsApi
      .get(id)
      .then(setContract)
      .catch((err) => setLoadError(extractErrorMessage(err, t('common.error'))))
      .finally(() => setIsLoading(false));
  }, [id, t]);

  async function handleRenew() {
    if (!id) return;
    try {
      const res = await contractsApi.renew(id);
      showToast(t('contracts.renewed'), 'success');
      navigate(`/contracts/${res.contract.id}`);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handleTerminate() {
    if (!id || !terminateReason.trim()) return;
    try {
      await contractsApi.terminate(id, terminateReason);
      showToast(t('contracts.terminated'), 'success');
      setTerminateOpen(false);
      setTerminateReason('');
      contractsApi.get(id).then(setContract);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handleSuspend() {
    if (!id) return;
    try {
      await contractsApi.update(id, { notes: suspendReason || undefined } as any);
      showToast(t('contracts.suspended'), 'success');
      setSuspendOpen(false);
      setSuspendReason('');
      contractsApi.get(id).then(setContract);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  if (isLoading) return <SkeletonDetail />;

  if (loadError || !contract) {
    return (
      <div className="flex flex-col gap-4">
        <Link to="/contracts" className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400">
          <ArrowLeft className="h-4 w-4" />
          {t('nav.contracts')}
        </Link>
        <p className="text-sm text-error-500">{loadError ?? t('common.error')}</p>
      </div>
    );
  }

  const clientName = contract.client
    ? [contract.client.first_name, contract.client.last_name].filter(Boolean).join(' ') || '—'
    : '—';

  const canRenew = contract.status === 'active' || contract.status === 'due_soon';
  const canTerminate = contract.status === 'active' || contract.status === 'due_soon' || contract.status === 'suspended';
  const canSuspend = contract.status === 'active';

  return (
    <div className="flex flex-col gap-6">
      <Link to="/contracts" className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400">
        <ArrowLeft className="h-4 w-4" />
        {t('nav.contracts')}
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{contract.number}</h1>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{clientName}</p>
        </div>
        <div className="flex gap-3">
          {canRenew && (
            <Button onClick={handleRenew}>
              <RotateCcw className="h-4 w-4" />
              {t('contracts.renew')}
            </Button>
          )}
          {canTerminate && (
            <Button variant="outline" onClick={() => setTerminateOpen(true)}>
              <XOctagon className="h-4 w-4" />
              {t('contracts.terminate')}
            </Button>
          )}
          {canSuspend && (
            <Button variant="outline" onClick={() => setSuspendOpen(true)}>
              <Pause className="h-4 w-4" />
              {t('contracts.suspend')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('nav.clients')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{clientName}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.agencyId')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {contract.agency ? `${contract.agency.name} (${contract.agency.code})` : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.amount')}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-800 dark:text-gray-100">
              {formatCurrency(contract.amount)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.startDate')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {new Date(contract.start_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.endDate')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {new Date(contract.end_date).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.billingCycle')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {BILLING_CYCLE_LABELS[contract.billing_cycle]}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.renewalCount')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{contract.renewal_count}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">{t('contracts.autoRenew')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {contract.auto_renew ? t('common.yes') : t('common.no')}
            </dd>
          </div>
          {contract.company && (
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('contracts.company')}</dt>
              <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{contract.company.name}</dd>
            </div>
          )}
        </dl>

        {contract.notes && (
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-800">
            <dt className="text-sm font-medium text-gray-500">{t('contracts.notes')}</dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{contract.notes}</dd>
          </div>
        )}
      </div>

      {contract.terminated_at && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 dark:border-red-900/30 dark:bg-red-900/10">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">{t('contracts.terminationInfo')}</h3>
          <p className="mt-1 text-sm text-red-600 dark:text-red-300">
            {t('contracts.terminatedOn')}:{' '}
            {new Date(contract.terminated_at).toLocaleDateString()}
          </p>
          {contract.terminated_reason && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-300">
              {t('contracts.terminateReason')}: {contract.terminated_reason}
            </p>
          )}
        </div>
      )}

      {contract.services && contract.services.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('contracts.services')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('contracts.serviceName')}</th>
                  <th className="px-5 py-3 font-medium">{t('contracts.serviceCode')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('contracts.servicePrice')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {contract.services.map((svc) => (
                  <tr key={svc.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{svc.name}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{svc.code ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-100">
                      {svc.pivot.price != null ? formatCurrency(svc.pivot.price) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {contract.parent_contract_id && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{t('contracts.renewalChain')}</h3>
          <div className="mt-2 flex items-center gap-2">
            <Link
              to={`/contracts/${contract.parent_contract_id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              {t('contracts.parentContract')}
            </Link>
            <span className="text-gray-400">→</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{contract.number}</span>
          </div>
        </div>
      )}

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

      <Modal isOpen={suspendOpen} onClose={() => setSuspendOpen(false)} title={t('contracts.suspend')} maxWidth="max-w-sm">
        <div className="flex flex-col gap-4">
          <Input
            label={t('contracts.suspendReason')}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setSuspendOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button onClick={handleSuspend} className="flex-1">{t('common.confirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
