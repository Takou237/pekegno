import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import { publicApi } from '@/api/public.api';
import { useToast } from '@/context/ToastContext';
import type { Invoice, AgencyPaymentMethod } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { ValidationBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { CreditCard, Smartphone, Download, Trash2 } from 'lucide-react';

export default function InvoicesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<AgencyPaymentMethod[]>([]);
  const [method, setMethod] = useState('orange_money');
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = () => {
    setLoading(true);
    clientApi.getInvoices().then((r) => setInvoices(r.data ?? [])).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openPayment = async (inv: Invoice) => {
    setSelected(inv);
    setPaymentMethods([]);
    setFile(null);
    setReference('');
    setPhone('');
    setMethod('orange_money');
    if (inv.agency_id) {
      try {
        const methods = await publicApi.getAgencyPaymentMethods(inv.agency_id);
        setPaymentMethods(methods);
      } catch {
        setPaymentMethods([]);
      }
    }
  };

  const handleUpload = async () => {
    if (!selected) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('payment_method', method);
      if (phone) formData.append('phone_number_used', phone);
      if (reference) formData.append('reference', reference);
      if (file) formData.append('file', file);
      await clientApi.uploadPaymentProof(selected.id, formData);
      showToast(t('checkout.proofSubmitted'), 'success');
      setSelected(null);
      setFile(null);
      setReference('');
      setPhone('');
      load();
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (inv: Invoice) => {
    try {
      const blob = await clientApi.downloadReceipt(inv.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facture-${inv.number}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      showToast(t('common.error'), 'error');
    }
  };

  const handleDelete = async (inv: Invoice) => {
    if (!window.confirm(t('account.deleteRejectedConfirm') ?? `Supprimer la facture ${inv.number} ?`)) return;
    try {
      await clientApi.deleteInvoice(inv.id);
      showToast(t('account.deletedRejected'), 'success');
      load();
    } catch {
      showToast(t('account.deleteRejectedError'), 'error');
    }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('account.invoices')}</h1>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">{t('account.noInvoices')}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">N°</th>
                  <th className="px-6 py-3">{t('account.date')}</th>
                  <th className="px-6 py-3">{t('account.validationStatus')}</th>
                  <th className="px-6 py-3">{t('account.status')}</th>
                  <th className="px-6 py-3 text-right">{t('account.total')}</th>
                  <th className="px-6 py-3">{t('account.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-brand-600">{inv.number}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(inv.created_at)}</td>
                    <td className="px-6 py-4"><ValidationBadge status={inv.validation_status} /></td>
                    <td className="px-6 py-4"><Badge variant={inv.status === 'paid' ? 'success' : inv.status === 'unpaid' ? 'warning' : 'neutral'}>{t(`status.${inv.status}`)}</Badge></td>
                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(inv.total_amount)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDownload(inv)}>
                          <Download size={14} className="mr-1" /> {t('account.downloadReceipt')}
                        </Button>
                        {inv.validation_status === 'pending' && (
                          <Button size="sm" onClick={() => openPayment(inv)}>
                            <CreditCard size={14} className="mr-1" /> {t('account.payNow')}
                          </Button>
                        )}
                        {inv.validation_status === 'rejected' && (
                          <Button size="sm" variant="danger" onClick={() => handleDelete(inv)}>
                            <Trash2 size={14} className="mr-1" /> {t('account.delete')}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={Boolean(selected)} onClose={() => setSelected(null)} title={t('checkout.payment')}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 text-sm">
              <p className="flex justify-between"><span className="text-gray-500">N°</span><span className="font-medium">{selected.number}</span></p>
              <p className="flex justify-between mt-2"><span className="text-gray-500">{t('account.total')}</span><span className="font-semibold">{formatCurrency(selected.total_amount)}</span></p>
              <p className="flex justify-between mt-2"><span className="text-gray-500">{t('account.amountPaid')}</span><span>{formatCurrency(selected.amount_paid)}</span></p>
              <p className="flex justify-between mt-2"><span className="text-gray-500">{t('account.dueAmount')}</span><span className="font-semibold text-brand-600">{formatCurrency(selected.balance_due)}</span></p>
            </div>

            {paymentMethods.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">{t('checkout.paymentMethods')}</p>
                <div className="space-y-2">
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

            <Select label={t('checkout.paymentMethod')} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="orange_money">Orange Money</option>
              <option value="mtn_momo">MTN MoMo</option>
              <option value="cash">Especes</option>
            </Select>

            <Input label={t('checkout.phoneNumber')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Input label={t('checkout.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('checkout.proofFile')}</label>
              <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} accept="image/jpeg,image/png,image/gif,image/webp" className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100" />
            </div>

            <div className="flex gap-3">
              <Button fullWidth onClick={handleUpload} isLoading={uploading} disabled={!file}>{t('checkout.submitProof')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
