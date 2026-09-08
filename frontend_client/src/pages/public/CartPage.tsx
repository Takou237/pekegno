import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi } from '@/api/public.api';
import { clientApi } from '@/api/client.api';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatCurrency } from '@/utils';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import type { Agency } from '@/types';

export default function CartPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, count, subtotal, updateQuantity, removeItem, clear } = useCart();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [selectedAgency, setSelectedAgency] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    publicApi.getAgencies().then(setAgencies).catch(() => {});
  }, []);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      navigate('/connexion?redirect=/panier');
      return;
    }
    if (!selectedAgency) {
      showToast(t('cart.selectAgencyRequired'), 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const result = await clientApi.checkout({
        agency_id: selectedAgency,
        lines: items.map((item) => ({
          line_type: 'catalog' as const,
          service_id: item.type === 'service' ? item.id : undefined,
          product_id: item.type === 'product' ? item.id : undefined,
          quantity: item.quantity,
        })),
      });
      clear();
      showToast(t('checkout.success'), 'success');
      navigate(`/paiement/${result.order.id}`);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <ShoppingCart size={48} className="mx-auto text-gray-300 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('cart.title')}</h1>
        <p className="text-gray-500 mb-6">{t('cart.empty')}</p>
        <Link to="/catalogue">
          <Button>{t('cart.browse')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('cart.title')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.key} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-4">
              {item.coverImage ? (
                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center shrink-0">
                  <span className="text-2xl font-bold text-brand-200">{item.name[0]}</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-brand-600 font-medium">
                      {item.type === 'service' ? t('catalog.typeServices') : t('catalog.typeProducts')}
                      {item.categoryName ? ` · ${item.categoryName}` : ''}
                    </p>
                    <Link to={`/produits/${item.slug ?? item.id}`} className="font-semibold text-gray-900 hover:text-brand-600 transition-colors line-clamp-2">
                      {item.name}
                    </Link>
                    {item.agencyName && <p className="text-xs text-gray-400 mt-0.5">{item.agencyName}</p>}
                  </div>
                  <button
                    onClick={() => removeItem(item.key)}
                    aria-label={t('cart.remove')}
                    className="text-gray-400 hover:text-error-600 transition-colors shrink-0"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="flex items-end justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      aria-label="-"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-10 text-center font-medium text-gray-900">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      aria-label="+"
                      className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">{formatCurrency(item.unitPrice)} × {item.quantity}</p>
                    <p className="text-lg font-bold text-brand-600">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 h-fit sticky top-20">
          <h2 className="font-semibold text-gray-900 mb-4">{t('cart.orderSummary')}</h2>

          <div className="flex items-center justify-between mb-2 text-sm text-gray-500">
            <span>{count} {t('cart.articles')}</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between mb-6 text-lg font-bold text-gray-900">
            <span>{t('cart.subtotal')}</span>
            <span className="text-brand-600">{formatCurrency(subtotal)}</span>
          </div>

          <div className="space-y-4">
            <Select label={t('cart.selectAgency')} value={selectedAgency} onChange={(e) => setSelectedAgency(e.target.value)}>
              <option value="">{t('cart.selectAgency')}</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.city ? ` - ${a.city}` : ''}</option>
              ))}
            </Select>

            {!isAuthenticated ? (
              <Alert variant="info">{t('product.loginToBuy')}</Alert>
            ) : null}

            <Button onClick={handleCheckout} isLoading={submitting} fullWidth disabled={!items.length}>
              {t('cart.checkout')} — {formatCurrency(subtotal)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}