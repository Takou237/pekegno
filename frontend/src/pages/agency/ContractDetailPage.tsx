import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Download, FileUp, Pause, Play, RotateCcw, XOctagon } from 'lucide-react';
import { contractsApi } from '@/api/contracts.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { canManageContracts } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { ReasonModal } from '@/components/agencyDept/ReasonModal';
import { BILLING_CYCLE_LABELS, CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, type Contract } from '@/types/contract';

/** Fiche contrat : 3 parties (Pekegno · client · prestation/package), factures, PDF, cycle de vie. */
export default function ContractDetailPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { basePath } = useAgencyDept();

  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<'suspend' | 'terminate' | null>(null);
  const canManage = canManageContracts(user);

  const load = useCallback(() => {
    if (!contractId) return;
    contractsApi.get(contractId).then(setContract).catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [contractId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      showToast(success, 'success');
      setReasonFor(null);
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  async function renew() {
    if (!contract) return;
    try {
      const child = await contractsApi.renew(contract.id);
      showToast(t('agencyDept.contracts.renewed'), 'success');
      navigate(`${basePath}/contracts/${child.id}`);
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  async function downloadPdf() {
    if (!contract) return;
    try {
      const blob = await contractsApi.pdf(contract.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contrat-${contract.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  async function uploadSigned(file: File) {
    if (!contract) return;
    await run(async () => {
      const uploaded = await uploadsApi.upload(file);
      await contractsApi.sign(contract.id, uploaded.path ?? uploaded.url);
    }, t('agencyDept.contracts.signedUploaded'));
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!contract) return <SkeletonDetail />;

  const c = contract;
  const open = ['pending', 'active', 'due_soon'].includes(c.status);

  return (
    <div className="flex flex-col gap-6">
      <Link to={`${basePath}/contracts`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400">
        <ArrowLeft className="h-4 w-4" /> {t('nav.contracts')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{c.number}</h1>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">{t(`agencyDept.contracts.origin.${c.origin ?? 'manual'}`)} · {c.start_date.slice(0, 10)} → {c.end_date.slice(0, 10)}</p>
          {c.status === 'pending' && <p className="mt-1 text-sm text-amber-600">{t('agencyDept.contracts.pendingHint')}</p>}
          {c.suspended_reason && <p className="mt-1 text-sm text-orange-600">{t('agencyDept.reason')} : {c.suspended_reason}</p>}
          {c.terminated_reason && <p className="mt-1 text-sm text-gray-500">{t('agencyDept.reason')} : {c.terminated_reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={downloadPdf}><Download className="h-4 w-4" /> PDF</Button>
          {canManage && (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200">
                <FileUp className="h-4 w-4" /> {t('agencyDept.contracts.uploadSigned')}
                <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadSigned(e.target.files[0])} />
              </label>
              {['active', 'due_soon', 'expired'].includes(c.status) && <Button size="sm" onClick={renew}><RotateCcw className="h-4 w-4" /> {t('agencyDept.contracts.renew')}</Button>}
              {open && <Button size="sm" variant="outline" onClick={() => setReasonFor('suspend')}><Pause className="h-4 w-4" /> {t('agencyDept.contracts.suspend')}</Button>}
              {c.status === 'suspended' && <Button size="sm" onClick={() => run(() => contractsApi.resume(c.id), t('agencyDept.saved'))}><Play className="h-4 w-4" /> {t('agencyDept.contracts.resume')}</Button>}
              {!['terminated', 'renewed'].includes(c.status) && <Button size="sm" variant="danger" onClick={() => setReasonFor('terminate')}><XOctagon className="h-4 w-4" /> {t('agencyDept.contracts.terminate')}</Button>}
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Party title={t('agencyDept.contracts.provider')} lines={[`Pekegno — ${c.agency?.name ?? ''}`]} />
        <Party title={t('agencyDept.client')} lines={[c.client ? `${c.client.first_name} ${c.client.last_name}` : '—', c.company?.name ?? '', c.client?.email ?? '']} />
        <Party
          title={t('agencyDept.contracts.object')}
          lines={[
            c.prestation ? `${t('agencyDept.prestation')} ${c.prestation.reference} — ${c.prestation.name}` : c.pack ? `${t('nav.packages')} : ${c.pack.name}` : t('agencyDept.contracts.origin.manual'),
            c.commercial ? `${t('agencyDept.commercial')} : ${c.commercial.first_name} ${c.commercial.last_name}` : '',
          ]}
          link={c.prestation ? `${basePath}/prestations/${c.prestation.id}` : undefined}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Info label={t('agencyDept.amount')} value={formatCurrency(c.amount)} />
        <Info label={t('agencyDept.contracts.budgetAllocated')} value={c.budget_allocated ? formatCurrency(c.budget_allocated) : '—'} />
        <Info label={t('agencyDept.contracts.billingCycle')} value={BILLING_CYCLE_LABELS[c.billing_cycle]} />
        <Info label={t('agencyDept.contracts.activatedAt')} value={c.activated_at?.slice(0, 10) ?? '—'} />
        <Info label={t('agencyDept.packages.autoRenew')} value={c.auto_renew ? t('common.yes') : t('common.no')} />
        <Info label={t('agencyDept.contracts.signed')} value={c.signed_document_path ? <a className="text-brand-600 hover:underline" href={c.signed_document_path.startsWith('http') ? c.signed_document_path : `/storage/${c.signed_document_path}`} target="_blank" rel="noreferrer">{c.signed_at?.slice(0, 10) ?? t('common.yes')}</a> : t('agencyDept.contracts.notSigned')} />
        <Info label={t('agencyDept.contracts.parent')} value={c.parent_contract ? <Link className="text-brand-600 hover:underline" to={`${basePath}/contracts/${c.parent_contract.id}`}>{c.parent_contract.number}</Link> : '—'} />
        <Info label={t('agencyDept.contracts.children')} value={c.child_contracts?.length ? c.child_contracts.map((ch) => <Link key={ch.id} className="mr-2 text-brand-600 hover:underline" to={`${basePath}/contracts/${ch.id}`}>{ch.number}</Link>) : '—'} />
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('nav.invoices')}</h2>
        {!c.invoices?.length ? (
          <p className="text-sm text-gray-500">{t('agencyDept.empty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400">
              <tr><th className="py-2">N°</th><th>{t('agencyDept.total')}</th><th>{t('agencyDept.paid')}</th><th>{t('agencyDept.balance')}</th><th>{t('agencyDept.contracts.payments')}</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {c.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="py-2"><Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">{inv.number}</Link></td>
                  <td>{formatCurrency(inv.total_amount)}</td>
                  <td>{formatCurrency(inv.amount_paid)}</td>
                  <td>{formatCurrency(inv.balance_due ?? Number(inv.total_amount) - Number(inv.amount_paid))}</td>
                  <td className="text-xs text-gray-500">{inv.payments?.map((p) => `${p.paid_at?.slice(0, 10)} · ${formatCurrency(p.amount)}`).join(' — ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ReasonModal
        isOpen={reasonFor !== null}
        title={reasonFor === 'suspend' ? t('agencyDept.contracts.suspend') : t('agencyDept.contracts.terminate')}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) =>
          run(
            () => (reasonFor === 'suspend' ? contractsApi.suspend(c.id, reason) : contractsApi.terminate(c.id, reason)),
            t('agencyDept.saved'),
          )
        }
      />
    </div>
  );
}

function Party({ title, lines, link }: { title: string; lines: string[]; link?: string }) {
  const body = (
    <div className="h-full rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs uppercase text-gray-400">{title}</p>
      {lines.filter(Boolean).map((l) => <p key={l} className="mt-1 text-sm text-gray-800 dark:text-gray-100">{l}</p>)}
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <div className="mt-1 text-sm text-gray-800 dark:text-gray-100">{value}</div>
    </div>
  );
}
