import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp, ShoppingCart, Coins, Star, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { commercialsApi } from '@/api/commercials.api';
import { invoicesApi } from '@/api/invoices.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTimeFr } from '@/utils/date';
import type { PaginationMeta } from '@/types/agency';
import { InvoiceStatusBadge } from '@/pages/invoices/InvoiceListPage';
import { ValidationBadge } from '@/pages/invoices/PendingInvoicesPage';
import type { Commercial, CommercialStats } from '@/types/commercial';
import type { Invoice } from '@/types/invoice';
import CommunityManagerDashboardPage from '@/pages/team/CommunityManagerDashboardPage';

/** Community-manager : tableau de bord dédié (ventes + prestations + actions). */
export default function CommercialSelfDashboardPage() {
  const { user } = useAuth();
  if (user?.role?.name === 'community-manager') {
    return <CommunityManagerDashboardPage />;
  }
  return <CommercialSelfDashboard />;
}

/**
 * Clic sur les cartes CA / Ventes : les factures validées du commercial qui les
 * composent (même définition que la carte : validées, non annulées).
 */
function MySalesModal({ commercialId, title, onClose }: { commercialId: string; title: string; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    invoicesApi
      .list({ commercial_id: commercialId, validation_status: 'validated', page, per_page: 25 })
      .then((res) => {
        if (!active) return;
        setRows(res.invoices.data ?? []);
        setMeta(res.invoices.meta ?? null);
      })
      .catch(() => { if (active) setRows([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [commercialId, page]);

  return (
    <Modal isOpen onClose={onClose} title={title} maxWidth="max-w-4xl">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('invoices.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {meta && <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfSalesCount', { count: meta.total })}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="py-2 pr-3 font-medium">{t('invoices.colAgency')}</th>
                  <th className="py-2 pr-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="py-2 text-right font-medium">{t('invoices.colPaid')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((inv) => (
                  <tr key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{inv.number}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatDateTimeFr(inv.invoice_date)}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? '—'}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{inv.agency?.name ?? '—'}</td>
                    <td className="py-2 pr-3 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(inv.total_amount, inv.currency_code)}</td>
                    <td className="py-2 text-right text-gray-600 dark:text-gray-300">{formatCurrency(inv.amount_paid, inv.currency_code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {meta && meta.last_page > 1 && (
            <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} />
          )}
        </div>
      )}
    </Modal>
  );
}

function CommercialSelfDashboard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [commercial, setCommercial] = useState<Commercial | null>(null);
  const [stats, setStats] = useState<CommercialStats | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [salesOpen, setSalesOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      // Source fiable : l'endpoint « moi » retrouve le profil du compte connecté
      // par user_id, sans dépendre d'une liste paginée (le profil pouvait manquer
      // de la première page — d'où « aucun commercial lié à votre compte »).
      const s = await commercialsApi.myStats();
      setStats(s);
      const mine: Commercial = {
        ...(commercial ?? ({} as Commercial)),
        id: s.commercial.id,
        user_id: user?.id ?? null,
        first_name: s.commercial.first_name,
        last_name: s.commercial.last_name,
        email: s.commercial.email,
        points_balance: s.commercial.points_balance,
        commission_type: s.commercial.commission_type,
        commission_value: s.commercial.commission_value,
        is_active: s.commercial.is_active,
        agency_id: s.commercial.agency_id,
        agency: s.commercial.agency,
      };
      setCommercial(mine);
      const invRes = await invoicesApi.list({ commercial_id: s.commercial.id, per_page: 10 });
      setInvoices(invRes.invoices.data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('commercials.loadFailed')));
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, t]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleDelete(inv: Invoice) {
    // B8 : l'annulation exige un motif (saisi, puis journalisé côté serveur).
    const reason = window.prompt(t('invoices.cancelReasonPrompt'));
    if (!reason?.trim()) return;
    setDeletingId(inv.id);
    try {
      await invoicesApi.cancel(inv.id, reason.trim());
      showToast(t('invoices.cancelled'), 'success');
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('invoices.cancelFailed')), 'error');
    } finally {
      setDeletingId(null);
    }
  }

  if (isLoading) {
    return <SkeletonDetail />;
  }

  if (loadError) {
    return <p className="text-sm text-error-500">{loadError}</p>;
  }

  if (!commercial) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.selfTitle')}</h1>
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfNoProfile')}</p>
        </div>
      </div>
    );
  }

  const firstName = commercial.first_name && commercial.last_name
    ? `${commercial.first_name} ${commercial.last_name}`
    : commercial.first_name || commercial.email || '';

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.selfTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {firstName} · {commercial.agency?.name ?? t('commercial.selfNoAgency')}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div role="button" onClick={() => setSalesOpen(t('commercial.selfTurnover'))} className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfTurnover')}</p>
          </div>
          <p className="mt-2 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
            {formatCurrency(stats?.turnover ?? 0)}
          </p>
        </div>
        <div role="button" onClick={() => setSalesOpen(t('commercial.selfSales'))} className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/30">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfSales')}</p>
          </div>
          <p className="mt-2 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">{stats?.sales_count ?? 0}</p>
        </div>
        <div role="button" onClick={() => navigate('/commercial/commissions')} className="cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 transition hover:border-brand-200 hover:shadow-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/30">
          <div className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-brand-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfCommissions')}</p>
          </div>
          <p className="mt-2 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">
            {formatCurrency(stats?.commissions ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('commercial.selfPoints')}</p>
          </div>
          <p className="mt-2 text-lg font-semibold sm:text-2xl text-gray-900 dark:text-white">{commercial.points_balance}</p>
        </div>
      </div>

      {salesOpen && commercial && (
        <MySalesModal commercialId={commercial.id} title={salesOpen} onClose={() => setSalesOpen(null)} />
      )}

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('commercial.selfRecentInvoices')}</h2>
          <Link to={`/invoices?commercial_id=${commercial.id}`} className="text-sm font-medium text-brand-600 hover:underline">
            {t('commercial.selfViewAll')}
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('invoices.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('invoices.colNumber')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colClient')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('invoices.colTotal')}</th>
                  <th className="px-5 py-3 font-medium">{t('invoices.colStatus')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <Link
                        to={`/invoices/${inv.id}`}
                        className="font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.invoice_date}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{inv.client_label ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800 dark:text-gray-100">
                      {formatCurrency(inv.total_amount)}
                    </td>
                    <td className="px-5 py-3">
                      {inv.validation_status === 'pending' ? (
                        <ValidationBadge status={inv.validation_status} />
                      ) : (
                        <InvoiceStatusBadge status={inv.status} />
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {inv.validation_status === 'pending' ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(inv)}
                          disabled={deletingId === inv.id}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:text-error-400 dark:hover:bg-error-500/10"
                          title={t('invoices.cancelInvoice')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {deletingId === inv.id ? t('common.loading') : t('invoices.cancelInvoice')}
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
