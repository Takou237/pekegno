import { useState, useEffect } from 'react';
import { useParams, Navigate, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import { publicApi } from '@/api/public.api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Order, AgencyPaymentMethod } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { ValidationBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Smartphone, XCircle, FileText, Package, Download } from 'lucide-react';

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AgencyPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [method, setMethod] = useState('orange_money');
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    clientApi.getOrder(orderId)
      .then(async (o) => {
        setOrder(o);
        if (o.agency_id) {
          try {
            setPaymentMethods(await publicApi.getAgencyPaymentMethods(o.agency_id));
          } catch {
            setPaymentMethods([]);
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (!isAuthenticated) {
    return <Navigate to={`/connexion?redirect=/paiement/${orderId}`} replace />;
  }

  const handleUpload = async () => {
    if (!order?.invoice) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('payment_method', method);
      if (phone) formData.append('phone_number_used', phone);
      if (reference) formData.append('reference', reference);
      if (file) formData.append('file', file);
      await clientApi.uploadPaymentProof(order.invoice.id, formData);
      showToast(t('checkout.proofSubmitted'), 'success');
      navigate('/mon-compte/factures');
    } catch {
      showToast(t('common.error'), 'error');
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!order?.invoice) return;
    try {
      const blob = await clientApi.downloadReceipt(order.invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${order.invoice.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('common.error'), 'error');
    }
  };

  if (loading) return <Spinner className="py-20" />;

  if (notFound || !order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <XCircle size={48} className="mx-auto text-error-400 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('payment.notFound')}</h1>
        <p className="text-gray-500 mb-6">{t('payment.notFoundHint')}</p>
        <Link to="/mon-compte/factures">
          <Button>{t('payment.goInvoices')}</Button>
        </Link>
      </div>
    );
  }

  const invoice = order.invoice;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('payment.title')}</h1>
      <p className="text-gray-500 mb-6">{t('payment.subtitle')}</p>

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package size={18} className="text-brand-600" /> {t('payment.orderSummary')}
            </h2>
            <span className="text-sm font-medium text-gray-500">
              {t('payment.order')} <span className="font-semibold text-brand-600">{order.number}</span>
            </span>
          </div>

          <div className="px-6 py-4">
            {order.agency && (
              <p className="text-sm text-gray-500 mb-4">
                {t('payment.agency')} : <span className="font-medium text-gray-700">{order.agency.name}</span>
                {order.agency.city ? ` — ${order.agency.city}` : ''}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="py-2 pr-4">{t('payment.item')}</th>
                    <th className="py-2 pr-4 text-center">{t('checkout.quantity')}</th>
                    <th className="py-2 pr-4 text-right">{t('product.price')}</th>
                    <th className="py-2 text-right">{t('account.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(order.lines ?? []).map((line) => (
                    <tr key={line.id}>
                      <td className="py-3 pr-4 font-medium text-gray-900">{line.label}</td>
                      <td className="py-3 pr-4 text-center text-gray-600">{line.quantity}</td>
                      <td className="py-3 pr-4 text-right text-gray-600">{formatCurrency(line.unit_price)}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">{formatCurrency(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="py-3 text-right text-gray-500 font-medium">{t('account.total')}</td>
                    <td className="py-3 text-right font-bold text-brand-600">{formatCurrency(order.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {invoice && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText size={18} className="text-brand-600" /> {t('payment.invoice')} {invoice.number}
              </h2>
              <div className="flex items-center gap-2">
                <ValidationBadge status={invoice.validation_status} />
                <Badge variant={invoice.status === 'paid' ? 'success' : 'warning'}>{t(`status.${invoice.status}`)}</Badge>
                <Button size="sm" variant="outline" onClick={handleDownload}>
                  <Download size={14} className="mr-1" /> {t('account.downloadReceipt')}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{t('account.date')}</p>
                <p className="font-medium text-gray-900">{formatDate(invoice.created_at)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">{t('account.amountPaid')}</p>
                <p className="font-medium text-gray-900">{formatCurrency(invoice.amount_paid)}</p>
              </div>
              <div className="bg-brand-50 rounded-lg p-4">
                <p className="text-xs text-brand-600 mb-1">{t('payment.amountDue')}</p>
                <p className="font-bold text-brand-700">{formatCurrency(invoice.balance_due)}</p>
              </div>
            </div>

            {invoice.status === 'paid' ? (
              <Alert variant="success">{t('payment.paid')}</Alert>
            ) : invoice.validation_status === 'validated' ? (
              <Alert variant="info">{t('payment.proofValidated')}</Alert>
            ) : invoice.validation_status === 'rejected' ? (
              <Alert variant="error">{t('payment.proofRejected')}{invoice.rejection_reason ? ` : ${invoice.rejection_reason}` : ''}</Alert>
            ) : (
              <>
                {paymentMethods.length > 0 && (
                  <div className="mb-6">
                    <p className="text-sm font-medium text-gray-700 mb-2">{t('checkout.paymentMethods')}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {paymentMethods.map((pm) => (
                        <div key={pm.id} className="flex items-center gap-3 p-3 bg-brand-50 rounded-lg">
                          <Smartphone size={18} className="text-brand-600 shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-gray-900 capitalize">{pm.provider.replace('_', ' ')}</p>
                            <p className="text-gray-600">{pm.phone_number ?? ''}{pm.account_holder ? ` — ${pm.account_holder}` : ''}</p>
                            {pm.instructions && <p className="text-xs text-gray-500 mt-1">{pm.instructions}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 pt-6 space-y-4">
                  <Select label={t('checkout.paymentMethod')} value={method} onChange={(e) => setMethod(e.target.value)}>
                    <option value="orange_money">Orange Money</option>
                    <option value="mtn_momo">MTN MoMo</option>
                    <option value="cash">{t('payment.cash')}</option>
                  </Select>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input label={t('checkout.phoneNumber')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <Input label={t('checkout.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.proofFile')}</label>
                    <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept="image/jpeg,image/png,image/gif,image/webp" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
                  </div>

                  <Button fullWidth onClick={handleUpload} isLoading={submitting} disabled={!file}>
                    {t('checkout.submitProof')}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}