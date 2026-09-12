import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import type { Order } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';

export default function OrdersPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientApi.getOrders()
      .then((r) => setOrders(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-20" />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('account.orders')}</h1>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">{t('account.noOrders')}</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">#</th>
                  <th className="px-6 py-3">{t('account.date')}</th>
                  <th className="px-6 py-3">{t('account.status')}</th>
                  <th className="px-6 py-3">{t('account.source')}</th>
                  <th className="px-6 py-3 text-right">{t('account.total')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-brand-600">#{o.id.slice(0, 8)}</td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(o.created_at)}</td>
                    <td className="px-6 py-4">
                      <Badge variant={(o.status === 'completed' || o.status === 'confirmed') ? 'success' : o.status === 'cancelled' ? 'error' : 'neutral'}>
                        {t(`status.${o.status}`)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{o.channel}</td>
                    <td className="px-6 py-4 text-right font-semibold">{formatCurrency(o.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
