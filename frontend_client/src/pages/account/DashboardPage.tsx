import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { clientApi } from '@/api/client.api';
import type { Order, Invoice, FormationEnrollment } from '@/types';
import { formatCurrency, formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { ValidationBadge, Badge } from '@/components/ui/Badge';
import { ShoppingCart, FileText, GraduationCap } from 'lucide-react';

export default function AccountDashboardPage() {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [enrollments, setEnrollments] = useState<FormationEnrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([clientApi.getOrders(), clientApi.getInvoices(), clientApi.getEnrollments()])
      .then(([o, i, en]) => {
        setOrders((o as { data?: Order[] }).data ?? []);
        setInvoices((i as { data?: Invoice[] }).data ?? []);
        setEnrollments((en as { data?: FormationEnrollment[] }).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner className="py-20" />;

  const stats = [
    { icon: ShoppingCart, label: t('account.totalOrders'), value: orders.length },
    { icon: FileText, label: t('account.totalInvoices'), value: invoices.length },
    { icon: GraduationCap, label: t('account.totalFormations'), value: enrollments.length },
  ];

  const pendingProofs = invoices.filter((i) => i.validation_status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('account.dashboard')}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                <Icon size={20} />
              </div>
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {pendingProofs > 0 && (
        <div className="bg-warning-50 border border-warning-200 rounded-xl p-4 text-sm text-warning-700 flex items-center justify-between">
          <span>{pendingProofs} facture(s) en attente de validation / paiement</span>
          <Link to="/mon-compte/factures" className="font-medium underline">{t('account.payNow')}</Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('account.orders')}</h2>
          {orders.length === 0 ? (
            <p className="text-sm text-gray-500">{t('account.noOrders')}</p>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 5).map((o) => (
                <Link key={o.id} to="/mon-compte/commandes" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-gray-900">#{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-gray-400">{formatDate(o.created_at)}</p>
                  </div>
                  <span className="font-semibold text-brand-600">{formatCurrency(o.total_amount)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 mb-4">{t('account.invoices')}</h2>
          {invoices.length === 0 ? (
            <p className="text-sm text-gray-500">{t('account.noInvoices')}</p>
          ) : (
            <div className="space-y-3">
              {invoices.slice(0, 5).map((inv) => (
                <Link key={inv.id} to="/mon-compte/factures" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-gray-900">{inv.number}</p>
                    <p className="text-xs text-gray-400">{formatDate(inv.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ValidationBadge status={inv.validation_status} />
                    <span className="font-semibold text-brand-600">{formatCurrency(inv.total_amount)}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-900 mb-4">{t('account.formations')}</h2>
        {enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">{t('account.noFormations')}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {enrollments.slice(0, 4).map((en) => (
              <div key={en.id} className="p-3 rounded-lg bg-gray-50">
                <p className="font-medium text-sm text-gray-900">{en.course?.name}</p>
                <Badge variant={en.status === 'active' ? 'success' : 'neutral'}>{t(`status.${en.status}`)}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
