import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, XCircle, ImageIcon, ExternalLink, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatDateTimeFr } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { PrintPortal } from '@/components/invoices/InvoicePrint';
import { PaymentReceiptPrint } from '@/components/invoices/PaymentReceiptPrint';
import type { Invoice, InvoicePayment, PaymentProof } from '@/types/invoice';
import type { PaginationMeta } from '@/types/agency';
import { useAuth } from '@/hooks/useAuth';
import { canValidateInvoices } from '@/utils/invoicePermissions';

/**
 * File de validation des paiements (super-admin / caissier) : les preuves de
 * règlement soumises par les commerciaux (montant restant + preuve) y sont
 * acceptées ou rejetées. Accepter une preuve encaisse automatiquement le
 * montant et génère un reçu, affiché ici immédiatement.
 */
export default function PaymentProofsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const canReviewProofs = canValidateInvoices(user?.role?.name);
  const [searchParams, setSearchParams] = useSearchParams();

  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [viewProof, setViewProof] = useState<PaymentProof | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);

  const [rejectTarget, setRejectTarget] = useState<PaymentProof | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectSubmitting, setRejectSubmitting] = useState(false);

  const [receipt, setReceipt] = useState<{ invoice: Invoice; payment: InvoicePayment } | null>(null);

  const fetchProofs = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await invoicesApi.listProofs({ status: 'pending', page, per_page: 15 });
      setProofs(res.data);
      setMeta(res.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [page, t]);

  useEffect(() => {
    fetchProofs();
  }, [fetchProofs]);

  // Ouverture directe d'une preuve depuis une facture (?proof=<id>).
  useEffect(() => {
    const proofId = searchParams.get('proof');
    if (!proofId || proofs.length === 0) return;
    const found = proofs.find((p) => p.id === proofId);
    if (!found) return;
    setViewProof(found);
    setProofError(null);
    const next = new URLSearchParams(searchParams);
    next.delete('proof');
    setSearchParams(next, { replace: true });
  }, [proofs, searchParams, setSearchParams]);

  async function handleApprove(proof: PaymentProof) {
    setSubmitting(true);
    setProofError(null);
    try {
      // On relève les versements existants avant l'acceptation pour identifier
      // celui créé par l'encaissement automatique.
      const before = await invoicesApi.get(proof.invoice_id).catch(() => null);
      const known = new Set((before?.payments ?? []).map((p) => p.id));

      await invoicesApi.approveProof(proof.id);
      showToast(t('invoices.proofApproved'), 'success');
      setViewProof(null);

      const after = await invoicesApi.get(proof.invoice_id).catch(() => null);
      const created = (after?.payments ?? []).find((p) => !known.has(p.id));
      if (after && created) setReceipt({ invoice: after, payment: created });

      fetchProofs();
    } catch (error) {
      setProofError(extractErrorMessage(error, t('invoices.proofError')));
    } finally {
      setSubmitting(false);
    }
  }

  function openReject(proof: PaymentProof) {
    setRejectTarget(proof);
    setRejectReason('');
    setProofError(null);
  }

  async function handleReject(event: FormEvent) {
    event.preventDefault();
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setProofError(t('invoices.proofRejectReasonRequired'));
      return;
    }
    setRejectSubmitting(true);
    setProofError(null);
    try {
      await invoicesApi.rejectProof(rejectTarget.id, rejectReason.trim());
      showToast(t('invoices.proofRejectedToast'), 'success');
      setRejectTarget(null);
      setViewProof(null);
      fetchProofs();
    } catch (error) {
      setProofError(extractErrorMessage(error, t('invoices.proofError')));
    } finally {
      setRejectSubmitting(false);
    }
  }

  function methodLabel(method: string): string {
    if (method === 'om') return t('invoices.paymentOm');
    if (method === 'momo') return t('invoices.paymentMomo');
    if (method === 'wave') return t('invoices.paymentWave');
    if (method === 'mobile') return t('invoices.paymentMobile');
    if (method === 'cash') return t('invoices.paymentCash');
    return method;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('invoices.paymentProofsTitlePage')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('invoices.paymentProofsSubtitle')}</p>
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
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.proofSubmittedBy')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.paymentMethod')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.proofAmount')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {proofs.map((proof) => {
                  const submitter = proof.submitter
                    ? [proof.submitter.first_name, proof.submitter.last_name].filter(Boolean).join(' ') || proof.submitter.email
                    : '—';
                  return (
                    <tr key={proof.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setViewProof(proof);
                            setProofError(null);
                          }}
                          className="inline-flex items-center gap-1.5 font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                        >
                          <ImageIcon className="h-4 w-4 text-gray-400" />
                          {proof.invoice?.number ?? '—'}
                        </button>
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{proof.invoice?.client_name ?? '—'}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{submitter}</td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{methodLabel(proof.payment_method)}</td>
                      <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                        {Number(proof.amount ?? 0) > 0 ? formatCurrency(proof.amount) : '—'}
                      </td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{formatDateTimeFr(proof.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setViewProof(proof);
                              setProofError(null);
                            }}
                            disabled={submitting}
                          >
                            <ImageIcon className="h-4 w-4" />
                            {t('invoices.proofExamine')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.last_page > 1 && (
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
        isOpen={viewProof !== null}
        onClose={() => setViewProof(null)}
        title={t('invoices.paymentProof')}
        maxWidth="max-w-lg"
      >
        {viewProof && (
          <div className="flex flex-col gap-4">
            {viewProof.file_url ? (
              <a
                href={viewProof.file_url}
                target="_blank"
                rel="noreferrer"
                className="group relative inline-flex justify-center rounded-xl border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-800"
              >
                <img src={viewProof.file_url} alt={t('invoices.paymentProof')} className="max-h-64 rounded-lg object-contain" />
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
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.colNumber')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {viewProof.invoice ? (
                    <Link to={`/invoices/${viewProof.invoice.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                      {viewProof.invoice.number}
                    </Link>
                  ) : (
                    '—'
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.colTotal')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {viewProof.invoice ? formatCurrency(viewProof.invoice.total_amount) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.paymentMethod')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{methodLabel(viewProof.payment_method)}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofAmount')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">
                  {Number(viewProof.amount ?? 0) > 0 ? formatCurrency(viewProof.amount) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofPhone')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{viewProof.phone_number_used ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">{t('invoices.proofReference')}</p>
                <p className="font-medium text-gray-800 dark:text-gray-100">{viewProof.reference ?? '—'}</p>
              </div>
            </div>

            {proofError && <Alert variant="error">{proofError}</Alert>}

            {canReviewProofs && (
              <div className="flex justify-end gap-3">
                <Button type="button" variant="danger" onClick={() => openReject(viewProof)} disabled={submitting}>
                  <XCircle className="h-4 w-4" />
                  {t('invoices.proofReject')}
                </Button>
                <Button type="button" onClick={() => handleApprove(viewProof)} isLoading={submitting}>
                  <Check className="h-4 w-4" />
                  {t('invoices.proofApprove')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        title={t('invoices.proofRejectTitle')}
        maxWidth="max-w-md"
      >
        {rejectTarget && (
          <form onSubmit={handleReject} className="flex flex-col gap-4">
            {proofError && <Alert variant="error">{proofError}</Alert>}
            <Input
              label={t('invoices.proofRejectReason')}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t('invoices.proofRejectReasonPlaceholder')}
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)} disabled={rejectSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="danger" isLoading={rejectSubmitting} disabled={!rejectReason.trim()}>
                {t('invoices.proofReject')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {receipt && (
        <PrintPortal>
          <PaymentReceiptPrint invoice={receipt.invoice} payment={receipt.payment} />
        </PrintPortal>
      )}

      <Modal
        isOpen={receipt !== null}
        onClose={() => setReceipt(null)}
        title={t('invoices.receiptTitle', { number: receipt?.payment.receipt_number ?? '' })}
        maxWidth="max-w-3xl"
      >
        {receipt && (
          <div className="flex flex-col gap-4">
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <PaymentReceiptPrint invoice={receipt.invoice} payment={receipt.payment} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReceipt(null)}>
                {t('common.close')}
              </Button>
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                {t('invoices.printReceipt')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
