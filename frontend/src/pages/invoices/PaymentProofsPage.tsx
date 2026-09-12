import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Check, XCircle, ImageIcon, ExternalLink, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatRelativeDate } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import type { PaymentProof, PaymentProofStatus } from '@/types/invoice';
import type { PaginationMeta } from '@/types/agency';

const STATUS_TABS: Array<{ value: PaymentProofStatus; labelKey: string }> = [
  { value: 'pending', labelKey: 'invoices.proofPending' },
  { value: 'accepted', labelKey: 'invoices.proofAccepted' },
  { value: 'rejected', labelKey: 'invoices.proofRejected' },
];

function ProofStatusBadge({ status }: { status: PaymentProofStatus }) {
  const { t } = useTranslation();
  switch (status) {
    case 'accepted':
      return <Badge variant="success">{t('invoices.proofAccepted')}</Badge>;
    case 'rejected':
      return <Badge variant="error">{t('invoices.proofRejected')}</Badge>;
    case 'pending':
      return <Badge variant="warning">{t('invoices.proofPending')}</Badge>;
  }
}

function submitterName(proof: PaymentProof): string {
  const full = [proof.submitter?.first_name, proof.submitter?.last_name].filter(Boolean).join(' ').trim();
  return full || proof.submitter?.email || '—';
}

export default function PaymentProofsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [status, setStatus] = useState<PaymentProofStatus>('pending');
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<PaymentProof | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchProofs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await invoicesApi.listProofs({ status, page, per_page: 15 });
      setProofs(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [status, page, t]);

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  function openProof(proof: PaymentProof) {
    setSelected(proof);
    setRejectMode(false);
    setRejectNotes('');
    setRejectError(null);
  }

  function closeProof() {
    setSelected(null);
    setRejectMode(false);
    setRejectNotes('');
    setRejectError(null);
  }

  async function handleApprove() {
    if (!selected) return;
    setSubmitting(true);
    setRejectError(null);
    try {
      await invoicesApi.approveProof(selected.id);
      showToast(t('invoices.proofApproved'), 'success');
      closeProof();
      fetchProofs();
    } catch (error) {
      const msg = extractErrorMessage(error, t('invoices.proofError'));
      setRejectError(msg);
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!rejectNotes.trim()) {
      setRejectError(t('invoices.rejectReasonRequired'));
      return;
    }
    setSubmitting(true);
    setRejectError(null);
    try {
      await invoicesApi.rejectProof(selected.id, rejectNotes.trim());
      showToast(t('invoices.proofRejectedToast'), 'success');
      closeProof();
      fetchProofs();
    } catch (error) {
      const msg = extractErrorMessage(error, t('invoices.proofError'));
      setRejectError(msg);
      if (msg) showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.paymentProofsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('invoices.paymentProofsHint')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              status === tab.value
                ? 'bg-brand-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            {tab.value === 'pending' && <ImageIcon className="h-4 w-4" />}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : proofs.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('invoices.proofsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.paymentProof')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.paymentType')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.proofReference')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.proofPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.proofSubmittedBy')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.proofStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {proofs.map((proof) => (
                  <tr key={proof.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openProof(proof)}
                        className="group inline-flex items-center gap-2 font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                      >
                        {proof.file_url ? (
                          <img
                            src={proof.file_url}
                            alt={t('invoices.paymentProof')}
                            className="h-10 w-10 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
                          />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                            <ImageIcon className="h-4 w-4 text-gray-400" />
                          </span>
                        )}
                        {t('invoices.proofView')}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      {proof.invoice ? (
                        <Link
                          to={`/invoices/${proof.invoice_id}`}
                          className="inline-flex items-center gap-1.5 font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                        >
                          <FileText className="h-4 w-4 text-gray-400" />
                          {proof.invoice.number}
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {proof.invoice?.client_name ?? submitterName(proof)}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {proof.invoice ? formatCurrency(proof.invoice.total_amount) : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{proof.payment_method || '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{proof.reference ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{proof.phone_number_used ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="text-gray-600 dark:text-gray-300">{submitterName(proof)}</div>
                      <div className="text-xs text-gray-400">{formatRelativeDate(proof.created_at)}</div>
                    </td>
                    <td className="px-5 py-3">
                      <ProofStatusBadge status={proof.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end">
                        <Button size="sm" variant="outline" onClick={() => openProof(proof)}>
                          {t('invoices.proofView')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={selected !== null}
        onClose={closeProof}
        title={t('invoices.paymentProof')}
        maxWidth="max-w-lg"
      >
        {selected && (
          <div className="flex flex-col gap-4">
            {selected.file_url ? (
              <a
                href={selected.file_url}
                target="_blank"
                rel="noreferrer"
                className="group relative inline-flex justify-center rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800"
              >
                <img
                  src={selected.file_url}
                  alt={t('invoices.paymentProof')}
                  className="max-h-64 rounded-lg object-contain"
                />
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-lg bg-gray-900/70 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  <ExternalLink className="h-3 w-3" />
                  {t('invoices.proofView')}
                </span>
              </a>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-xl bg-gray-100 text-sm text-gray-400 dark:bg-gray-800">
                {t('invoices.proofView')}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-gray-50 p-3 text-sm dark:bg-gray-800/60">
              {selected.invoice && (
                <>
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('invoices.colNumber')}</p>
                    <Link
                      to={`/invoices/${selected.invoice_id}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {selected.invoice.number}
                    </Link>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-gray-400">{t('invoices.colTotal')}</p>
                    <p className="font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(selected.invoice.total_amount)}
                    </p>
                  </div>
                </>
              )}
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.paymentType')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{selected.payment_method || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofPhone')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{selected.phone_number_used ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofReference')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{selected.reference ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofSubmittedBy')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{submitterName(selected)}</p>
                <p className="text-xs text-gray-400">{formatRelativeDate(selected.created_at)}</p>
              </div>
            </div>

            {selected.reviewed_by && selected.notes && (
              <div className="rounded-xl border border-error-200 bg-error-50 p-3 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/20 dark:text-error-300">
                <p className="text-xs uppercase">{t('invoices.proofRejectReason')}</p>
                {selected.notes}
              </div>
            )}

            {selected.status === 'pending' && (
              <form onSubmit={handleReject} className="flex flex-col gap-4">
                {rejectError && <Alert variant="error">{rejectError}</Alert>}

                {rejectMode && (
                  <Input
                    label={t('invoices.proofRejectReason')}
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    error={rejectError ?? undefined}
                    placeholder={t('invoices.proofRejectReason')}
                  />
                )}

                <div className="flex justify-end gap-3">
                  {rejectMode ? (
                    <>
                      <Button type="button" variant="outline" onClick={() => setRejectMode(false)} disabled={submitting}>
                        {t('common.cancel')}
                      </Button>
                      <Button type="submit" variant="danger" isLoading={submitting} disabled={!rejectNotes.trim()}>
                        <XCircle className="h-4 w-4" />
                        {t('invoices.proofReject')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => setRejectMode(true)}
                        disabled={submitting}
                      >
                        <XCircle className="h-4 w-4" />
                        {t('invoices.proofReject')}
                      </Button>
                      <Button type="button" onClick={handleApprove} isLoading={submitting}>
                        <Check className="h-4 w-4" />
                        {t('invoices.proofApprove')}
                      </Button>
                    </>
                  )}
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}