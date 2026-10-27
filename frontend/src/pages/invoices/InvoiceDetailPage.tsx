import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer, XCircle, Wallet, Pencil, ImageIcon, ThumbsUp, ThumbsDown, Receipt, Camera, HandCoins, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { invoicesApi } from '@/api/invoices.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { usersApi } from '@/api/users.api';
import { servicesApi } from '@/api/services.api';
import { productsApi, type ProductSearchItem } from '@/api/products.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { businessInstantForDay, formatDateTimeFr, formatRelativeDate, todayLocal } from '@/utils/date';
import { formatCurrency } from '@/utils/number';
import { invoiceBackPath, invoiceListPathForDetail } from '@/utils/invoiceNavigation';
import { Button } from '@/components/ui/Button';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Autocomplete, FREE_TEXT_PREFIX, type AutocompleteOption } from '@/components/ui/Autocomplete';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InvoicePrint, InvoicePrintPortal, PrintPortal } from '@/components/invoices/InvoicePrint';
import { PaymentReceiptPrint } from '@/components/invoices/PaymentReceiptPrint';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import { ValidationBadge } from '@/pages/invoices/PendingInvoicesPage';
import type { Invoice, PaymentMethod, PaymentProof } from '@/types/invoice';
import { canValidateInvoices } from '@/utils/invoicePermissions';
import { useAgencyCurrency } from '@/hooks/useAgencyCurrency';
import type { ServiceSearchItem } from '@/types/service';

interface EditInvoiceLine {
  key: string;
  id?: string;
  kind: 'service' | 'product' | 'free';
  service_id: string;
  product_id: string;
  label: string;
  unit_price: string;
  quantity: string;
  pass_tier: string;
}

let editLineCounter = 0;
function newEditLine(): EditInvoiceLine {
  editLineCounter += 1;
  return { key: `edit-line-${editLineCounter}`, kind: 'service', service_id: '', product_id: '', label: '', unit_price: '', quantity: '1', pass_tier: '' };
}

function invoiceItemToEditLine(item: NonNullable<Invoice['items']>[number]): EditInvoiceLine {
  editLineCounter += 1;
  return {
    key: `edit-line-${editLineCounter}`,
    id: item.id,
    kind: item.service_id ? 'service' : item.product_id ? 'product' : 'free',
    service_id: item.service_id ?? '',
    product_id: item.product_id ?? '',
    label: item.label ?? '',
    unit_price: String(item.unit_price ?? ''),
    quantity: String(item.quantity ?? 1),
    pass_tier: item.pass_tier ?? '',
  };
}

export default function InvoiceDetailPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { id: routeId = '', invoiceId = '' } = useParams();
  const id = invoiceId || routeId;
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Retour contextuel : la liste d'origine (avec ses filtres et sa page) si elle
  // a été mémorisée, sinon la liste du niveau courant — une facture ouverte
  // depuis un pays ne renvoie plus vers la liste globale.
  const backToList = invoiceBackPath(
    location.state,
    invoiceListPathForDetail(location.pathname, fixedAgencyId),
    searchParams,
  );

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [printOpen, setPrintOpen] = useState(false);
  // Versement dont le reçu est affiché (imprimable même si la facture n'est pas soldée).
  const [receiptPaymentId, setReceiptPaymentId] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(false);

  const [proofPreview, setProofPreview] = useState<PaymentProof | null>(null);
  const [rejectProofTarget, setRejectProofTarget] = useState<PaymentProof | null>(null);
  const [rejectProofNotes, setRejectProofNotes] = useState('');
  const [proofSubmitting, setProofSubmitting] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);

  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash');
  const [payComment, setPayComment] = useState('');
  const [payPaidAt, setPayPaidAt] = useState('');
  const [payErrors, setPayErrors] = useState<Record<string, string>>({});
  const [paySubmitting, setPaySubmitting] = useState(false);

  // « Payer le reste » (commercial / vendeur) : montant + moyen + preuve,
  // transmis au caissier qui encaisse à l'acceptation.
  const [remainingOpen, setRemainingOpen] = useState(false);
  const [remAmount, setRemAmount] = useState('');
  const [remMethod, setRemMethod] = useState<PaymentMethod>('cash');
  const [remPhone, setRemPhone] = useState('');
  const [remReference, setRemReference] = useState('');
  const [remFile, setRemFile] = useState<File | null>(null);
  const [remPreview, setRemPreview] = useState<string | null>(null);
  const [remErrors, setRemErrors] = useState<Record<string, string>>({});
  const [remSubmitting, setRemSubmitting] = useState(false);

  const [editClientId, setEditClientId] = useState('');
  const [editCommercialId, setEditCommercialId] = useState('');
  const [editSellerLabel, setEditSellerLabel] = useState('');
  const [editSellerIsTrainer, setEditSellerIsTrainer] = useState(false);
  const [editSellerUserId, setEditSellerUserId] = useState('');
  const [editPaymentType, setEditPaymentType] = useState<'' | PaymentMethod>('');
  const [editInvoiceDate, setEditInvoiceDate] = useState('');
  const [editPayerPhone, setEditPayerPhone] = useState('');
  const [editAdvance, setEditAdvance] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editVatRate, setEditVatRate] = useState('');
  const [editLines, setEditLines] = useState<EditInvoiceLine[]>([newEditLine()]);
  const [editCatalogRevision, setEditCatalogRevision] = useState(0);
  const editServiceResultsRef = useRef<Record<string, ServiceSearchItem[]>>({});
  const editProductResultsRef = useRef<Record<string, ProductSearchItem[]>>({});
  const [editComment, setEditComment] = useState('');
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [cancelSubmitting, setCancelSubmitting] = useState(false);

  const canCollect = ['super-admin', 'direction-generale', 'caissier'].includes(
    currentUser?.role?.name ?? ''
  );
  const canReviewPaymentProofs = canValidateInvoices(currentUser?.role?.name);

  const canEditInvoice = Boolean(
    invoice &&
      currentUser &&
      !invoice.is_cancelled &&
      invoice.validation_status !== 'validated' &&
      invoice.created_by === currentUser.id
  );

  const isCommercial = currentUser?.role?.name === 'commercial';
  const editCurrency = useAgencyCurrency(invoice?.agency_id);
  const editTotals = useMemo(() => {
    const subtotal = editLines.reduce(
      (sum, line) => sum + (Number(line.unit_price) || 0) * (Number(line.quantity) || 0),
      0,
    );
    const discount = Math.min(Math.max(Number(editDiscount) || 0, 0), subtotal);
    const afterDiscount = subtotal - discount;
    const vat = afterDiscount * ((Number(editVatRate) || 0) / 100);
    const total = Math.round((afterDiscount + vat) * 100) / 100;
    const advance = Number(editAdvance) || 0;
    return { subtotal, discount, vat, total, advance, balance: Math.max(0, total - advance) };
  }, [editLines, editDiscount, editVatRate, editAdvance]);

  const fetchInvoice = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const inv = await invoicesApi.get(id);
      setInvoice(inv);
      setEditClientId(inv.client_name ? FREE_TEXT_PREFIX + inv.client_name : inv.client_id ?? '');
      const invoiceHasTrainerSeller = !inv.commercial_id && Boolean(inv.seller_user_id);
      setEditCommercialId(inv.commercial_id ?? inv.seller_user_id ?? '');
      setEditSellerLabel(inv.commercial
        ? [inv.commercial.first_name, inv.commercial.last_name].filter(Boolean).join(' ')
        : inv.seller
          ? [inv.seller.first_name, inv.seller.last_name].filter(Boolean).join(' ') || inv.seller.email
          : '');
      setEditSellerIsTrainer(invoiceHasTrainerSeller);
      setEditSellerUserId(inv.seller_user_id ?? '');
      setEditPaymentType(inv.payment_type ?? '');
      setEditComment(inv.comment ?? '');
      setEditInvoiceDate(String(inv.invoice_date ?? '').slice(0, 10));
      setEditPayerPhone(inv.payer_phone ?? '');
      setEditAdvance(inv.declared_advance ?? '');
      setEditDiscount(inv.discount ?? '0');
      setEditVatRate(inv.vat_rate ?? '0');
      const initialLines = (inv.items ?? []).map(invoiceItemToEditLine);
      setEditLines(initialLines.length ? initialLines : [newEditLine()]);
      // Arrivée depuis la liste des en attente ("Valider") : ouvrir directement
      // la première preuve de paiement à analyser.
      // Arrivée depuis « Encaisser » : ouvrir le reçu du versement demandé.
      const receiptParam = searchParams.get('receipt');
      if (receiptParam) {
        if ((inv.payments ?? []).some((p) => p.id === receiptParam)) setReceiptPaymentId(receiptParam);
        const next = new URLSearchParams(searchParams);
        next.delete('receipt');
        setSearchParams(next, { replace: true });
      }
      if (searchParams.get('review') === 'proof') {
        const pending = (inv.payment_proofs ?? []).find((p) => p.status === 'pending');
        if (pending) {
          setProofPreview(pending);
          setProofError(null);
        }
        const next = new URLSearchParams(searchParams);
        next.delete('review');
        setSearchParams(next, { replace: true });
      }
      // Arrivée depuis la liste (« Imprimer ») : ouvrir directement l'impression.
      if (searchParams.get('print') === '1') {
        setPrintOpen(true);
        const next = new URLSearchParams(searchParams);
        next.delete('print');
        setSearchParams(next, { replace: true });
      }
      return inv;
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('invoices.loadFailed')));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  useEffect(() => {
    if (!remFile) {
      setRemPreview(null);
      return;
    }
    const url = URL.createObjectURL(remFile);
    setRemPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [remFile]);

  function resetPayForm() {
    setPayAmount('');
    setPayComment('');
    setPayPaidAt(todayLocal());
    setPayErrors({});
  }

  function resetEditForm() {
    setEditErrors({});
    if (!invoice) return;
    setEditClientId(invoice.client_name ? FREE_TEXT_PREFIX + invoice.client_name : invoice.client_id ?? '');
    const invoiceHasTrainerSeller = !invoice.commercial_id && Boolean(invoice.seller_user_id);
    setEditCommercialId(invoice.commercial_id ?? invoice.seller_user_id ?? '');
    setEditSellerLabel(invoice.commercial
      ? [invoice.commercial.first_name, invoice.commercial.last_name].filter(Boolean).join(' ')
      : invoice.seller
        ? [invoice.seller.first_name, invoice.seller.last_name].filter(Boolean).join(' ') || invoice.seller.email
        : '');
    setEditSellerIsTrainer(invoiceHasTrainerSeller);
    setEditSellerUserId(invoice.seller_user_id ?? '');
    setEditPaymentType(invoice.payment_type ?? '');
    setEditComment(invoice.comment ?? '');
    setEditInvoiceDate(String(invoice.invoice_date ?? '').slice(0, 10));
    setEditPayerPhone(invoice.payer_phone ?? '');
    setEditAdvance(invoice.declared_advance ?? '');
    setEditDiscount(invoice.discount ?? '0');
    setEditVatRate(invoice.vat_rate ?? '0');
    const initialLines = (invoice.items ?? []).map(invoiceItemToEditLine);
    setEditLines(initialLines.length ? initialLines : [newEditLine()]);
    editServiceResultsRef.current = {};
    editProductResultsRef.current = {};
  }

  function openPay() {
    resetPayForm();
    setPayOpen(true);
  }

  // Fermer une modale sans valider ne doit rien laisser derrière : la
  // réouverture repart d'un formulaire vierge, aligné sur la facture.
  function closePay() {
    setPayOpen(false);
    resetPayForm();
  }

  function closeEdit() {
    setEditOpen(false);
    resetEditForm();
  }

  async function handlePay(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      setPayErrors({ amount: t('invoices.payAmountError') });
      return;
    }
    if (amount > invoice.balance_due) {
      setPayErrors({ amount: t('invoices.payOverpayment') });
      return;
    }
    setPaySubmitting(true);
    setPayErrors({});
    try {
      const knownIds = new Set((invoice.payments ?? []).map((p) => p.id));
      const updated = await invoicesApi.pay(invoice.id, {
        amount,
        payment_method: payMethod,
        paid_at: payPaidAt ? businessInstantForDay(payPaidAt) : undefined,
        comment: payComment || undefined,
      });
      showToast(t('invoices.paid'), 'success');
      closePay();
      await fetchInvoice();
      // Proposer directement le reçu du versement qui vient d'être encaissé.
      const created = (updated.payments ?? []).find((p) => !knownIds.has(p.id));
      if (created) setReceiptPaymentId(created.id);
    } catch (error) {
      setPayErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.payFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setPaySubmitting(false);
    }
  }

  function openRemaining() {
    if (!invoice) return;
    setRemAmount(String(invoice.balance_due));
    setRemMethod('cash');
    setRemPhone('');
    setRemReference('');
    setRemFile(null);
    setRemErrors({});
    setRemainingOpen(true);
  }

  function closeRemaining() {
    setRemainingOpen(false);
    setRemErrors({});
    setRemFile(null);
  }

  async function handleRemaining(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const amount = Number(remAmount);
    if (!amount || amount <= 0) {
      setRemErrors({ amount: t('invoices.payAmountError') });
      return;
    }
    if (amount > invoice.balance_due) {
      setRemErrors({ amount: t('invoices.payOverpayment') });
      return;
    }
    if (!remFile) {
      setRemErrors({ file: t('invoices.remainingProofRequired') });
      return;
    }
    setRemSubmitting(true);
    setRemErrors({});
    try {
      await invoicesApi.payRemaining(invoice.id, {
        amount,
        payment_method: remMethod,
        phone_number_used: remPhone || undefined,
        reference: remReference || undefined,
        file: remFile,
      });
      showToast(t('invoices.remainingSent'), 'success');
      closeRemaining();
      fetchInvoice();
    } catch (error) {
      setRemErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.payFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setRemSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!invoice) return;
    setCancelSubmitting(true);
    try {
      await invoicesApi.cancel(invoice.id);
      showToast(t('invoices.cancelled'), 'success');
      setCancelTarget(false);
      // Une facture annulée n'est plus modifiable ni encaissable : on referme
      // les formulaires ouverts et on repart d'un état propre, sans quitter
      // la page (le lien de retour ci-dessus ramène à la liste d'origine).
      setPrintOpen(false);
      setPayOpen(false);
      setEditOpen(false);
      setProofPreview(null);
      setRejectProofTarget(null);
      setRejectProofNotes('');
      setProofError(null);
      resetPayForm();
      resetEditForm();
      fetchInvoice();
    } catch (error) {
      showToast(extractErrorMessage(error, t('invoices.cancelFailed')), 'error');
    } finally {
      setCancelSubmitting(false);
    }
  }

  function openEdit() {
    resetEditForm();
    const lines = (invoice?.items ?? []).map(invoiceItemToEditLine);
    lines.filter((line) => line.service_id).forEach((line) => {
      servicesApi.search(line.label).then((results) => {
        editServiceResultsRef.current[line.key] = results;
        setEditCatalogRevision((revision) => revision + 1);
      }).catch(() => {});
    });
    setEditLines(lines.length ? lines : [newEditLine()]);
    setEditOpen(true);
  }

  function updateEditLine(key: string, patch: Partial<EditInvoiceLine>) {
    setEditLines((lines) => lines.map((line) => line.key === key ? { ...line, ...patch } : line));
  }

  function removeEditLine(key: string) {
    setEditLines((lines) => lines.length > 1 ? lines.filter((line) => line.key !== key) : lines);
  }

  function selectEditService(key: string, serviceId: string) {
    const service = (editServiceResultsRef.current[key] ?? []).find((result) => result.id === serviceId);
    if (!service) {
      updateEditLine(key, { service_id: '', pass_tier: '' });
      return;
    }
    const tiers = service.seminar_tiers ?? [];
    const tier = tiers[0];
    updateEditLine(key, {
      kind: 'service',
      service_id: service.id,
      product_id: '',
      label: service.name,
      unit_price: String(tier?.price ?? service.effective_price ?? service.price ?? ''),
      pass_tier: tier?.tier ?? '',
    });
  }

  function selectEditProduct(key: string, productId: string) {
    const product = (editProductResultsRef.current[key] ?? []).find((result) => result.id === productId);
    if (!product) {
      updateEditLine(key, { product_id: '' });
      return;
    }
    updateEditLine(key, {
      kind: 'product',
      product_id: product.id,
      service_id: '',
      label: product.name,
      unit_price: String(product.selling_price ?? product.price_with_tax ?? ''),
      pass_tier: '',
    });
  }

  async function handleEdit(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const validLines = editLines.filter((line) => line.label.trim() || line.service_id || line.product_id || Number(line.unit_price) > 0);
    if (!validLines.length) {
      setEditErrors({ items: t('invoices.noItems') });
      return;
    }
    if (!editClientId) {
      setEditErrors({ client_id: t('invoices.colClient') });
      return;
    }
    if ((editPaymentType === 'om' || editPaymentType === 'momo') && !editPayerPhone.trim()) {
      setEditErrors({ payer_phone: t('invoices.payerPhoneRequired') });
      return;
    }
    if (editTotals.advance > editTotals.total) {
      setEditErrors({ advance: t('invoices.advanceExceedsTotal') });
      return;
    }
    setEditSubmitting(true);
    setEditErrors({});
    try {
      const freeClientName = editClientId.startsWith(FREE_TEXT_PREFIX) ? editClientId.slice(FREE_TEXT_PREFIX.length) : '';
      const updated = await invoicesApi.update(invoice.id, {
        client_id: freeClientName ? null : editClientId || null,
        client_name: freeClientName || null,
        commercial_id: editSellerIsTrainer ? null : editCommercialId || null,
        seller_user_id: editSellerUserId || null,
        invoice_date: editInvoiceDate,
        payment_type: editPaymentType || null,
        payer_phone: editPaymentType === 'om' || editPaymentType === 'momo' ? editPayerPhone.trim() : null,
        comment: editComment || null,
        advance: Number(editAdvance) || 0,
        discount: Number(editDiscount) || 0,
        vat_rate: Number(editVatRate) || 0,
        items: validLines.map((line) => ({
          id: line.id,
          service_id: line.kind === 'service' ? line.service_id || undefined : undefined,
          product_id: line.kind === 'product' ? line.product_id || undefined : undefined,
          label: line.label.trim() || undefined,
          unit_price: Number(line.unit_price) || 0,
          quantity: Number(line.quantity) || 1,
          pass_tier: line.kind === 'service' ? line.pass_tier || undefined : undefined,
        })),
      });
      setInvoice((current) => current ? { ...current, ...updated } : updated);
      setEditClientId(updated.client_name ? FREE_TEXT_PREFIX + updated.client_name : updated.client_id ?? '');
      const updatedHasTrainerSeller = !updated.commercial_id && Boolean(updated.seller_user_id);
      setEditCommercialId(updated.commercial_id ?? updated.seller_user_id ?? '');
      setEditSellerLabel(updated.commercial
        ? [updated.commercial.first_name, updated.commercial.last_name].filter(Boolean).join(' ')
        : updated.seller
          ? [updated.seller.first_name, updated.seller.last_name].filter(Boolean).join(' ') || updated.seller.email
          : '');
      setEditSellerIsTrainer(updatedHasTrainerSeller);
      setEditSellerUserId(updated.seller_user_id ?? '');
      setEditPaymentType(updated.payment_type ?? '');
      setEditInvoiceDate(String(updated.invoice_date ?? '').slice(0, 10));
      setEditPayerPhone(updated.payer_phone ?? '');
      setEditAdvance(updated.declared_advance ?? '');
      setEditDiscount(updated.discount ?? '0');
      setEditVatRate(updated.vat_rate ?? '0');
      const updatedLines = (updated.items ?? []).map(invoiceItemToEditLine);
      setEditLines(updatedLines.length ? updatedLines : [newEditLine()]);
      setEditComment(updated.comment ?? '');
      showToast(t('invoices.updated'), 'success');
      setEditOpen(false);
    } catch (error) {
      setEditErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('invoices.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleApproveProof(proof: PaymentProof) {
    setProofSubmitting(true);
    setProofError(null);
    const knownIds = new Set((invoice?.payments ?? []).map((p) => p.id));
    const isRemaining = Number(proof.amount ?? 0) > 0;
    try {
      const result = await invoicesApi.approveProof(proof.id);
      if (result.invoice?.validation_status === 'validated') {
        showToast(t('invoices.validated', { number: result.invoice.number }), 'success');
      } else {
        showToast(t('invoices.proofApproved'), 'success');
      }
      setProofPreview(null);
      const updated = await fetchInvoice();
      // Règlement du reste à payer : l'acceptation encaisse automatiquement, on
      // affiche donc directement le reçu du versement créé.
      if (isRemaining) {
        const created = (updated?.payments ?? []).find((p) => !knownIds.has(p.id));
        if (created) setReceiptPaymentId(created.id);
      }
    } catch (error) {
      setProofError(extractErrorMessage(error, t('invoices.proofError')));
    } finally {
      setProofSubmitting(false);
    }
  }

  function openRejectProof(proof: PaymentProof) {
    setRejectProofTarget(proof);
    setRejectProofNotes('');
    setProofError(null);
  }

  async function handleRejectProof() {
    if (!rejectProofTarget) return;
    if (!rejectProofNotes.trim()) {
      setProofError(t('invoices.proofRejectReasonRequired'));
      return;
    }
    setProofSubmitting(true);
    setProofError(null);
    try {
      const result = await invoicesApi.rejectProof(rejectProofTarget.id, rejectProofNotes.trim());
      if (result.invoice?.validation_status === 'rejected') {
        showToast(t('invoices.rejected', { number: result.invoice.number }), 'success');
      } else {
        showToast(t('invoices.proofRejectedToast'), 'success');
      }
      setRejectProofTarget(null);
      setProofPreview(null);
      fetchInvoice();
    } catch (error) {
      setProofError(extractErrorMessage(error, t('invoices.proofError')));
    } finally {
      setProofSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <SkeletonDetail />
    );
  }

  if (loadError || !invoice) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to={backToList}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.title')}
        </Link>
        <p className="text-sm text-error-500">{loadError ?? t('invoices.loadFailed')}</p>
      </div>
    );
  }

  // Super-admin et caissier peuvent imprimer une facture impayée ou partielle ;
  // les autres profils gardent l'impression réservée aux factures soldées.
  const canPrintUnpaid = ['super-admin', 'caissier'].includes(currentUser?.role?.name ?? '');
  const canPrint = invoice.status === 'paid' || canPrintUnpaid;

  // « Payer le reste » : le commercial (ou le vendeur) règle le solde d'une
  // facture partielle déjà validée, via une preuve qui part chez le caissier.
  const isSeller = invoice.seller_user_id != null && invoice.seller_user_id === currentUser?.id;
  const canPayRemaining =
    !invoice.is_cancelled &&
    invoice.validation_status === 'validated' &&
    invoice.status !== 'paid' &&
    invoice.balance_due > 0 &&
    (isCommercial || isSeller);
  // Versements dans l'ordre chronologique ; le n° d'ordre affiché est le rang du
  // reçu dans cette séquence. `paid_at` étant daté au jour, deux versements du
  // même jour ont la même valeur : on départage par le numéro de reçu
  // (séquentiel) plutôt que par l'id (UUID aléatoire) — sinon l'ordre et la
  // numérotation changent à chaque rechargement.
  const sortedPayments = [...(invoice.payments ?? [])].sort((a, b) => {
    const byDate = new Date(a.paid_at ?? 0).getTime() - new Date(b.paid_at ?? 0).getTime();
    if (byDate !== 0) return byDate;
    return (a.receipt_number ?? '').localeCompare(b.receipt_number ?? '');
  });
  const receiptPayment = invoice.payments?.find((p) => p.id === receiptPaymentId) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={backToList}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('invoices.backToList')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('invoices.detailTitle', { number: invoice.number })}
            </h1>
            <InvoiceStatusBadge status={invoice.status} />
            {invoice.validation_status !== 'validated' && (
              <ValidationBadge status={invoice.validation_status} />
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setPrintOpen(true)}
              disabled={!canPrint}
              title={!canPrint ? t('invoices.printPendingPayment') : undefined}
            >
              <Printer className="h-4 w-4" />
              {t('invoices.print')}
            </Button>
            {!invoice.is_cancelled && !invoice.payments?.length && canEditInvoice && (
              <Button variant="outline" onClick={openEdit}>
                <Pencil className="h-4 w-4" />
                {t('common.edit')}
              </Button>
            )}
            {!invoice.is_cancelled && invoice.status !== 'paid' && canCollect && (
              <Button onClick={openPay} disabled={invoice.payments ? invoice.payments.length >= 3 : false}>
                <Wallet className="h-4 w-4" />
                {t('invoices.pay')}
              </Button>
            )}
            {canPayRemaining && (
              <Button onClick={openRemaining}>
                <HandCoins className="h-4 w-4" />
                {t('invoices.payRemaining')}
              </Button>
            )}
            {!invoice.is_cancelled && (!isCommercial || invoice.validation_status !== 'validated') && (
              <Button variant="danger" onClick={() => setCancelTarget(true)} disabled={cancelSubmitting}>
                <XCircle className="h-4 w-4" />
                {t('invoices.cancelInvoice')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.totalAmount')}</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
            {formatCurrency(invoice.total_amount, invoice.currency_code)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.paidAmount')}</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
            {formatCurrency(invoice.amount_paid, invoice.currency_code)}
          </p>
          {Number(invoice.amount_paid) === 0 &&
            invoice.validation_status === 'pending' &&
            Number(invoice.declared_advance ?? 0) > 0 && (
              <p className="mt-1 text-xs italic text-amber-600 dark:text-amber-400">
                {formatCurrency(invoice.declared_advance, invoice.currency_code)} {t('invoices.declaredAdvance')} — {t('invoices.declaredAdvanceHint')}
              </p>
            )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.balanceDue')}</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
            {formatCurrency(invoice.balance_due, invoice.currency_code)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.invoiceDate')}</p>
          <p className="mt-1 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {formatRelativeDate(invoice.invoice_date)}
          </p>
          <p className="text-xs text-gray-400">
            {new Date(invoice.invoice_date).toLocaleString(currentLocale())}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.clientLabel')}</p>
          {invoice.client_label ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {invoice.client_label}
              </p>
              {invoice.client && (
                <>
                  <p className="text-gray-600 [overflow-wrap:anywhere] dark:text-gray-300">{invoice.client.email}</p>
                  {invoice.client.phone && (
                    <p className="text-gray-600 dark:text-gray-300">{invoice.client.phone}</p>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.commercialLabel')}</p>
          {invoice.commercial ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {[invoice.commercial.first_name, invoice.commercial.last_name].filter(Boolean).join(' ')}
              </p>
              {invoice.commercial.email && (
                <p className="text-gray-600 [overflow-wrap:anywhere] dark:text-gray-300">{invoice.commercial.email}</p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('invoices.seller')}</p>
          {invoice.seller ? (
            <div className="mt-1 text-sm">
              <p className="font-semibold text-gray-800 dark:text-gray-100">
                {[invoice.seller.first_name, invoice.seller.last_name].filter(Boolean).join(' ') || invoice.seller.email}
              </p>
              {invoice.payment_type && (
                <p className="text-gray-600 dark:text-gray-300">
                  {invoice.payment_type === 'cash'
                    ? t('invoices.paymentCash')
                    : invoice.payment_type === 'om'
                    ? t('invoices.paymentOm')
                    : t('invoices.paymentMomo')}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-1 text-sm text-gray-400">—</p>
          )}
        </div>
      </div>

      {sortedPayments.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.paymentHistory')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentOrder')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentDate')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentMethod')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.treasuryAccount')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.paymentAmount')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.paymentReceivedBy')}</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sortedPayments.map((p, index) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">#{index + 1}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {formatDateTimeFr(p.paid_at)}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.payment_method === 'cash' ? t('invoices.paymentCash') : p.payment_method === 'om' ? t('invoices.paymentOm') : p.payment_method === 'momo' ? t('invoices.paymentMomo') : t('invoices.paymentMobile')}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.treasury_account?.name ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(p.amount, invoice.currency_code)}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {p.receiver
                        ? [p.receiver.first_name, p.receiver.last_name].filter(Boolean).join(' ') || p.receiver.email
                        : '—'}
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="outline" size="sm" onClick={() => setReceiptPaymentId(p.id)} title={p.receipt_number ?? undefined}>
                        <Receipt className="h-4 w-4" />
                        {t('invoices.receipt')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {invoice.payment_proofs && invoice.payment_proofs.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.paymentProofsTitle')}
          </h2>
          {invoice.validation_status === 'pending' && invoice.payment_proofs.length > 0 && (
            <p className="mb-3 text-xs italic text-amber-600 dark:text-amber-400">
              {t('invoices.paymentProofsHint')}
            </p>
          )}
          <div className="space-y-3">
            {invoice.payment_proofs.map((proof) => (
              <div
                key={proof.id}
                className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-700 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProofPreview(proof)}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
                    title={t('invoices.proofView')}
                  >
                    {proof.file_url ? (
                      <img src={proof.file_url} alt={t('invoices.paymentProof')} className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                  <div className="text-sm">
                    <p className="font-medium capitalize text-gray-800 dark:text-gray-100">
                      {proof.payment_method === 'om'
                        ? t('invoices.paymentOm')
                        : proof.payment_method === 'momo'
                        ? t('invoices.paymentMomo')
                        : proof.payment_method}
                      {Number(proof.amount ?? 0) > 0 && (
                        <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                          {formatCurrency(proof.amount, invoice.currency_code)}
                        </span>
                      )}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400">
                      {t('invoices.proofStatus')}:{' '}
                      {proof.status === 'pending'
                        ? t('invoices.proofPending')
                        : proof.status === 'accepted'
                        ? t('invoices.proofAccepted')
                        : t('invoices.proofRejected')}
                    </p>
                    {proof.reference && (
                      <p className="text-gray-500 dark:text-gray-400">
                        {t('invoices.proofReference')}: {proof.reference}
                      </p>
                    )}
                    {proof.notes && (
                      <p className="text-xs text-error-500 dark:text-error-400">{proof.notes}</p>
                    )}
                  </div>
                </div>
                {proof.status === 'pending' && canReviewPaymentProofs && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => setProofPreview(proof)}>
                      <ImageIcon className="h-4 w-4" />
                      {t('invoices.proofView')}
                    </Button>
                    <Button size="sm" onClick={() => handleApproveProof(proof)} isLoading={proofSubmitting}>
                      <ThumbsUp className="h-4 w-4" />
                      {t('invoices.proofApprove')}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => openRejectProof(proof)}>
                      <ThumbsDown className="h-4 w-4" />
                      {t('invoices.proofReject')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.items')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('invoices.itemLabel')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.quantity')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.unitPrice')}</th>
                  <th className="py-2 text-right font-medium">{t('invoices.lineTotal')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {(invoice.items ?? []).map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 pr-3 text-gray-800 dark:text-gray-100">
                      <span>{item.label}</span>
                      {item.pass_label && (
                        <span className="ml-1.5 inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                          {item.pass_label}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(item.unit_price, invoice.currency_code)}
                    </td>
                    <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(item.line_total, invoice.currency_code)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoice.comment && (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              {t('invoices.headerComment')} : {invoice.comment}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('invoices.totalAmount')}
          </h2>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t('invoices.totalAfterDiscount')}</span>
              <span>
                {formatCurrency(Number(invoice.total_amount) + Number(invoice.discount) - Number(invoice.vat_amount), invoice.currency_code)}
              </span>
            </div>
            {Number(invoice.discount) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>{t('invoices.discountLabel')}</span>
                <span>- {formatCurrency(invoice.discount, invoice.currency_code)}</span>
              </div>
            )}
            {Number(invoice.vat_rate) > 0 && (
              <div className="flex justify-between text-gray-600 dark:text-gray-300">
                <span>{t('invoices.vatAmount')} ({invoice.vat_rate}%)</span>
                <span>+ {formatCurrency(invoice.vat_amount, invoice.currency_code)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium text-gray-800 dark:text-gray-100">
              <span>{t('invoices.totalAmount')}</span>
              <span>{formatCurrency(invoice.total_amount, invoice.currency_code)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-300">
              <span>{t('invoices.paidAmount')}</span>
              <span>{formatCurrency(invoice.amount_paid, invoice.currency_code)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-gray-800 dark:text-gray-100">
              <span>{t('invoices.balanceDue')}</span>
              <span>{formatCurrency(invoice.balance_due, invoice.currency_code)}</span>
            </div>
          </div>
        </div>
      </div>

      {printOpen && <InvoicePrintPortal invoice={invoice} />}
      {receiptPayment && (
        <PrintPortal>
          <PaymentReceiptPrint invoice={invoice} payment={receiptPayment} />
        </PrintPortal>
      )}

      <Modal
        isOpen={receiptPayment !== null}
        onClose={() => setReceiptPaymentId(null)}
        title={t('invoices.receiptTitle', { number: receiptPayment?.receipt_number ?? '' })}
        maxWidth="max-w-3xl"
      >
        {receiptPayment && (
          <div className="flex flex-col gap-4">
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <PaymentReceiptPrint invoice={invoice} payment={receiptPayment} />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setReceiptPaymentId(null)}>
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

      <Modal
        isOpen={printOpen}
        onClose={() => setPrintOpen(false)}
        title={t('invoices.printTitle')}
        maxWidth="max-w-3xl"
      >
        <div className="flex flex-col gap-4">
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <InvoicePrint invoice={invoice} />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPrintOpen(false)}>
              {t('common.close')}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              {t('invoices.print')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={payOpen}
        onClose={closePay}
        title={t('invoices.payTitle')}
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePay} className="flex flex-col gap-4">
          {Object.keys(payErrors).length > 0 && (
            <Alert variant="error">{Object.values(payErrors).join(' ')}</Alert>
          )}
          <Input
            label={t('invoices.payAmount')}
            type="number"
            min={0.01}
            step="0.01"
            required
            max={invoice.balance_due}
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            error={payErrors.amount}
            hint={Number(payAmount) > invoice.balance_due && payAmount !== '' ? `⚠ ${t('invoices.payOverpayment')} (${formatCurrency(invoice.balance_due, invoice.currency_code)})` : `${t('invoices.balanceDueShort')} : ${formatCurrency(invoice.balance_due, invoice.currency_code)}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('invoices.payMethod')}
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="om">{t('invoices.paymentOm')}</option>
              <option value="momo">{t('invoices.paymentMomo')}</option>
            </Select>
            <Input
              label={t('invoices.payDate')}
              type="date"
              value={payPaidAt}
              onChange={(e) => setPayPaidAt(e.target.value)}
            />
          </div>
          <Input
            label={t('invoices.payComment')}
            value={payComment}
            onChange={(e) => setPayComment(e.target.value)}
            error={payErrors.comment}
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closePay} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={paySubmitting} className="flex-1" disabled={!payAmount || Number(payAmount) <= 0 || Number(payAmount) > invoice.balance_due}>
              {t('common.confirm')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={remainingOpen}
        onClose={closeRemaining}
        title={t('invoices.payRemainingTitle', { number: invoice.number })}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleRemaining} className="flex flex-col gap-4">
          {Object.keys(remErrors).length > 0 && (
            <Alert variant="error">{Object.values(remErrors).join(' ')}</Alert>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('invoices.payRemainingHint')}</p>
          <Input
            label={t('invoices.payRemainingAmount')}
            type="number"
            min={0.01}
            step="0.01"
            required
            max={invoice.balance_due}
            value={remAmount}
            onChange={(e) => setRemAmount(e.target.value)}
            error={remErrors.amount}
            hint={`${t('invoices.balanceDueShort')} : ${formatCurrency(invoice.balance_due, invoice.currency_code)}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label={t('invoices.payMethod')}
              value={remMethod}
              onChange={(e) => setRemMethod(e.target.value as PaymentMethod)}
            >
              <option value="cash">{t('invoices.paymentCash')}</option>
              <option value="om">{t('invoices.paymentOm')}</option>
              <option value="momo">{t('invoices.paymentMomo')}</option>
            </Select>
            <Input
              label={t('invoices.proofPhone')}
              value={remPhone}
              onChange={(e) => setRemPhone(e.target.value)}
            />
          </div>
          <Input
            label={t('invoices.proofReference')}
            value={remReference}
            onChange={(e) => setRemReference(e.target.value)}
          />
          <div className="flex flex-col gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('invoices.payRemainingProofHint')}</p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-700 dark:border-gray-700 dark:text-gray-400">
              <Camera className="h-4 w-4" />
              {remFile ? remFile.name : t('invoices.uploadProof')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={(e) => {
                  setRemFile(e.target.files?.[0] ?? null);
                  e.target.value = '';
                }}
              />
            </label>
            {remPreview && (
              <img
                src={remPreview}
                alt={t('invoices.paymentProof')}
                className="max-h-40 rounded-lg border border-gray-200 object-contain dark:border-gray-700"
              />
            )}
            {remErrors.file && <p className="text-xs text-error-500">{remErrors.file}</p>}
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeRemaining} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              isLoading={remSubmitting}
              className="flex-1"
              disabled={!remFile || !remAmount || Number(remAmount) <= 0 || Number(remAmount) > invoice.balance_due}
            >
              {t('invoices.remainingSubmit')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editOpen}
        onClose={closeEdit}
        title={t('invoices.editTitle')}
        maxWidth="max-w-5xl"
      >
        <form onSubmit={handleEdit} className="flex flex-col gap-5" data-catalog-revision={editCatalogRevision}>
          {Object.keys(editErrors).length > 0 && (
            <Alert variant="error">{Object.values(editErrors).join(' ')}</Alert>
          )}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Autocomplete
                label={t('invoices.headerClient')}
                placeholder={t('invoices.headerClientPlaceholder')}
                value={editClientId}
                onChange={setEditClientId}
                freeText
                fetchOptions={async (query) => {
                  const res = await clientsApi.search(query.trim());
                  return res.map((client) => ({
                    id: client.id,
                    label: [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || '',
                    subtitle: client.email,
                  }));
                }}
                error={editErrors.client_id}
              />
              <Autocomplete
                label={t('invoices.seller')}
                placeholder={t('invoices.headerCommercialPlaceholder')}
                value={editCommercialId}
                onChange={(id) => {
                  setEditCommercialId(id);
                  if (!id) {
                    setEditSellerLabel('');
                    setEditSellerIsTrainer(false);
                    setEditSellerUserId('');
                  }
                }}
                onPick={(option) => {
                  setEditSellerLabel(option.label);
                  setEditSellerIsTrainer(Boolean(option.isTrainer));
                  setEditSellerUserId(option.userId ?? (option.isTrainer ? option.id : ''));
                }}
                selectedOption={editCommercialId ? {
                  id: editCommercialId,
                  label: editSellerLabel,
                } : null}
                fetchOptions={async (query) => {
                  // Liste de tous les comptes du staff (clients exclus) : un
                  // vendeur est attribuable même s'il n'a pas encore de fiche.
                  const [usersRes, comsRes] = await Promise.all([
                    usersApi.list({ search: query.trim() || undefined, per_page: 100 }).catch(() => ({ data: [] })),
                    commercialsApi.list({ include_trainers: true, per_page: 100 }).catch(() => ({ data: [] })),
                  ]);
                  // Fiches formateurs : la vente est rattachée via le compte
                  // utilisateur (seller_user_id), comme avant.
                  const trainerProfileByUserId = new Map<string, string>();
                  for (const c of comsRes.data) {
                    if (c.is_trainer && c.user_id) trainerProfileByUserId.set(c.user_id, c.id);
                  }
                  return usersRes.data
                    .filter((u) => u.role?.name !== 'client')
                    .map((u) => {
                      const trainerProfileId = trainerProfileByUserId.get(u.id);
                      const label = u.name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email;
                      return trainerProfileId
                        ? { id: trainerProfileId, userId: u.id, isTrainer: true, label, subtitle: u.email }
                        : { id: u.id, label, subtitle: u.role?.name ?? u.email };
                    });
                }}
              />
              <Input label={t('invoices.headerAgency')} value={invoice?.agency?.name ?? ''} disabled />
              <Input
                label={t('invoices.headerDate')}
                type="date"
                value={editInvoiceDate}
                onChange={(event) => setEditInvoiceDate(event.target.value)}
                error={editErrors.invoice_date}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Select
                  label={t('invoices.headerPaymentType')}
                  value={editPaymentType}
                  onChange={(event) => setEditPaymentType(event.target.value as '' | PaymentMethod)}
                  error={editErrors.payment_type}
                >
                  <option value="">—</option>
                  <option value="cash">{t('invoices.paymentCash')}</option>
                  <option value="om">{t('invoices.paymentOm')}</option>
                  <option value="momo">{t('invoices.paymentMomo')}</option>
                  <option value="mobile">{t('invoices.paymentMobile')}</option>
                </Select>
                {(editPaymentType === 'om' || editPaymentType === 'momo') && (
                  <Input
                    label={`${t('invoices.payerPhone')} *`}
                    value={editPayerPhone}
                    onChange={(event) => setEditPayerPhone(event.target.value)}
                    error={editErrors.payer_phone}
                    hint={t('invoices.payerPhoneHint')}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
            <h3 className="mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">{t('invoices.items')}</h3>
            <div className="flex flex-col gap-4">
              {editLines.map((line, index) => {
                const services = editServiceResultsRef.current[line.key] ?? [];
                const selectedService = services.find((service) => service.id === line.service_id);
                const tiers = selectedService?.seminar_tiers ?? [];
                return (
                  <div key={line.key} className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
                    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                      <div className="sm:col-span-2">
                        <Select
                          label={index === 0 ? t('invoices.itemKind') : undefined}
                          value={line.kind}
                          onChange={(event) => {
                            const kind = event.target.value as EditInvoiceLine['kind'];
                            updateEditLine(line.key, {
                              kind,
                              service_id: kind === 'service' ? line.service_id : '',
                              product_id: kind === 'product' ? line.product_id : '',
                              pass_tier: kind === 'service' ? line.pass_tier : '',
                            });
                          }}
                        >
                          <option value="service">{t('invoices.kindService')}</option>
                          <option value="product">{t('invoices.kindProduct')}</option>
                          <option value="free">{t('invoices.kindFree')}</option>
                        </Select>
                      </div>
                      <div className="sm:col-span-4">
                        {line.kind === 'service' ? (
                          <Autocomplete
                            label={index === 0 ? t('invoices.itemService') : undefined}
                            placeholder={t('invoices.itemServicePlaceholder')}
                            value={line.service_id}
                            selectedOption={line.service_id ? { id: line.service_id, label: line.label } : null}
                            onChange={(serviceId) => selectEditService(line.key, serviceId)}
                            fetchOptions={async (query) => {
                              const results = await servicesApi.search(query.trim(), invoice?.agency_id ?? undefined);
                              editServiceResultsRef.current[line.key] = results;
                              return results.map((service) => ({ id: service.id, label: service.name }));
                            }}
                          />
                        ) : line.kind === 'product' ? (
                          <Autocomplete
                            label={index === 0 ? t('invoices.itemProduct') : undefined}
                            placeholder={t('invoices.itemProductPlaceholder')}
                            value={line.product_id}
                            selectedOption={line.product_id ? { id: line.product_id, label: line.label } : null}
                            onChange={(productId) => selectEditProduct(line.key, productId)}
                            fetchOptions={async (query) => {
                              const results = await productsApi.search(query.trim(), invoice?.agency_id ?? undefined);
                              editProductResultsRef.current[line.key] = results;
                              return results.map((product) => ({ id: product.id, label: product.name }));
                            }}
                          />
                        ) : (
                          <Input
                            label={index === 0 ? t('invoices.itemLabel') : undefined}
                            value={line.label}
                            onChange={(event) => updateEditLine(line.key, { label: event.target.value })}
                            error={editErrors[`items.${index}.label`]}
                          />
                        )}
                      </div>
                      {line.kind !== 'free' && (
                        <div className="sm:col-span-3">
                          <Input
                            label={index === 0 ? t('invoices.itemLabel') : undefined}
                            value={line.label}
                            onChange={(event) => updateEditLine(line.key, { label: event.target.value })}
                          />
                        </div>
                      )}
                      {line.kind === 'service' && line.pass_tier && tiers.length > 0 && (
                        <div className="sm:col-span-3">
                          <Select
                            label={index === 0 ? t('invoices.passTier') : undefined}
                            value={line.pass_tier}
                            onChange={(event) => {
                              const tier = tiers.find((candidate) => candidate.tier === event.target.value);
                              updateEditLine(line.key, {
                                pass_tier: event.target.value,
                                unit_price: tier ? String(tier.price) : line.unit_price,
                              });
                            }}
                          >
                            {tiers.map((tier) => <option key={tier.tier} value={tier.tier}>{tier.label}</option>)}
                          </Select>
                        </div>
                      )}
                      <div className="sm:col-span-2">
                        <Input
                          label={index === 0 ? t('invoices.itemQuantity') : undefined}
                          type="number"
                          min={1}
                          step={1}
                          value={line.quantity}
                          onChange={(event) => updateEditLine(line.key, { quantity: event.target.value })}
                          error={editErrors[`items.${index}.quantity`]}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Input
                          label={index === 0 ? t('invoices.itemUnitPrice') : undefined}
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.unit_price}
                          onChange={(event) => updateEditLine(line.key, { unit_price: event.target.value })}
                          error={editErrors[`items.${index}.unit_price`]}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:col-span-3 sm:justify-end">
                        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {formatCurrency((Number(line.unit_price) || 0) * (Number(line.quantity) || 0), editCurrency)}
                        </span>
                        <button type="button" onClick={() => removeEditLine(line.key)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800" title={t('invoices.removeLine')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button type="button" variant="outline" onClick={() => setEditLines((lines) => [...lines, newEditLine()])} className="mt-4">
              <Plus className="h-4 w-4" />
              {t('invoices.addLine')}
            </Button>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('invoices.discount')}
                type="number"
                min={0}
                step="0.01"
                value={editDiscount}
                onChange={(event) => setEditDiscount(event.target.value)}
                error={editErrors.discount}
                hint={t('invoices.discountHint', { currency: editCurrency })}
              />
              <Input
                label={t('invoices.vatRate')}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={editVatRate}
                onChange={(event) => setEditVatRate(event.target.value)}
                error={editErrors.vat_rate}
                hint={t('invoices.vatHint')}
              />
              <Input
                label={t('invoices.advance')}
                type="number"
                min={0}
                step="0.01"
                value={editAdvance}
                onChange={(event) => setEditAdvance(event.target.value)}
                error={editErrors.advance}
                hint={t('invoices.declaredAdvanceHint')}
              />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('invoices.headerComment')}</label>
                <textarea
                  value={editComment}
                  onChange={(event) => setEditComment(event.target.value)}
                  placeholder={t('invoices.headerCommentPlaceholder')}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                {editErrors.comment && <p className="mt-1 text-sm text-error-500">{editErrors.comment}</p>}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
              <div className="text-sm"><span className="text-gray-500">{t('invoices.totalAfterDiscount')}</span><p className="text-lg font-semibold">{formatCurrency(editTotals.subtotal, editCurrency)}</p></div>
              {editTotals.discount > 0 && <div className="text-sm"><span className="text-gray-500">- {t('invoices.discount')}</span><p className="text-lg font-semibold text-error-500">- {formatCurrency(editTotals.discount, editCurrency)}</p></div>}
              {editTotals.vat > 0 && <div className="text-sm"><span className="text-gray-500">{t('invoices.vatAmount')}</span><p className="text-lg font-semibold">+ {formatCurrency(editTotals.vat, editCurrency)}</p></div>}
              <div className="text-sm"><span className="text-gray-500">{t('invoices.totalAmount')}</span><p className="text-lg font-semibold">{formatCurrency(editTotals.total, editCurrency)}</p></div>
              <div className="text-sm"><span className="text-gray-500">{t('invoices.balanceDue')}</span><p className="text-lg font-semibold text-brand-600">{formatCurrency(editTotals.balance, editCurrency)}</p></div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={closeEdit}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={editSubmitting}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={cancelTarget}
        title={t('invoices.cancelTitle')}
        message={t('invoices.cancelMessage', { number: invoice.number })}
        confirmLabel={t('invoices.cancelInvoice')}
        variant="danger"
        isLoading={cancelSubmitting}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(false)}
      />

      <Modal
        isOpen={proofPreview !== null}
        onClose={() => setProofPreview(null)}
        title={t('invoices.proofView')}
        maxWidth="max-w-2xl"
      >
        {proofPreview && (
          <div className="flex flex-col gap-4">
            {proofError && <Alert variant="error">{proofError}</Alert>}
            {proofPreview.file_url ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <img src={proofPreview.file_url} alt={t('invoices.paymentProof')} className="max-h-[60vh] w-full object-contain" />
              </div>
            ) : (
              <p className="text-sm text-gray-500">—</p>
            )}
            <div className="text-sm text-gray-600 dark:text-gray-300">
              <p className="flex justify-between"><span>{t('invoices.paymentMethod')}</span><span className="font-medium capitalize">{proofPreview.payment_method}</span></p>
              {Number(proofPreview.amount ?? 0) > 0 && (
                <p className="flex justify-between mt-1"><span>{t('invoices.proofAmount')}</span><span className="font-medium">{formatCurrency(proofPreview.amount, invoice.currency_code)}</span></p>
              )}
              {proofPreview.phone_number_used && <p className="flex justify-between mt-1"><span>{t('invoices.proofPhone')}</span><span className="font-medium">{proofPreview.phone_number_used}</span></p>}
              {proofPreview.reference && <p className="flex justify-between mt-1"><span>{t('invoices.proofReference')}</span><span className="font-medium">{proofPreview.reference}</span></p>}
              {proofPreview.submitter && (
                <p className="flex justify-between mt-1">
                  <span>{t('invoices.proofSubmittedBy')}</span>
                  <span className="font-medium">
                    {[proofPreview.submitter.first_name, proofPreview.submitter.last_name].filter(Boolean).join(' ') || proofPreview.submitter.email}
                  </span>
                </p>
              )}
            </div>
            {proofPreview.status === 'pending' && canReviewPaymentProofs && (
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => openRejectProof(proofPreview)} disabled={proofSubmitting}>
                  <ThumbsDown className="h-4 w-4" />
                  {t('invoices.proofReject')}
                </Button>
                <Button onClick={() => handleApproveProof(proofPreview)} isLoading={proofSubmitting}>
                  <ThumbsUp className="h-4 w-4" />
                  {t('invoices.proofApprove')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={rejectProofTarget !== null}
        onClose={() => setRejectProofTarget(null)}
        title={t('invoices.proofRejectTitle')}
        maxWidth="max-w-md"
      >
        {rejectProofTarget && (
          <form onSubmit={(e) => { e.preventDefault(); handleRejectProof(); }} className="flex flex-col gap-4">
            {proofError && <Alert variant="error">{proofError}</Alert>}
            <Input
              label={t('invoices.proofRejectReason')}
              value={rejectProofNotes}
              onChange={(e) => setRejectProofNotes(e.target.value)}
              error={proofError ?? undefined}
              placeholder={t('invoices.proofRejectReasonPlaceholder')}
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setRejectProofTarget(null)} disabled={proofSubmitting}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="danger" isLoading={proofSubmitting} disabled={!rejectProofNotes.trim()}>
                {t('invoices.proofReject')}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
