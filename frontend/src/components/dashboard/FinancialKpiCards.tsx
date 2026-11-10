import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowDownCircle, Clock, Hourglass, PiggyBank, TrendingUp, Wallet } from 'lucide-react';
import { client } from '@/api/client';
import { formatCurrency } from '@/utils/number';
import { formatDateTimeFr } from '@/utils/date';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';

/** Périmètre des cartes, pour en afficher le détail (mêmes filtres que la carte). */
export interface KpiDetailsScope {
  from?: string;
  to?: string;
  agency_id?: string;
  country_id?: string;
  city_id?: string;
  department_id?: string;
}

type DetailCard = 'revenue' | 'payments_total' | 'advances_total' | 'outstanding' | 'expenses_total' | 'pending_validation_total';

interface DetailRow {
  id: string;
  invoice_id?: string;
  number?: string | number | null;
  client?: string | null;
  agency?: string | null;
  label?: string | null;
  category?: string | null;
  method?: string | null;
  date?: string | null;
  invoice_total?: number;
  paid?: number;
  amount: number;
  is_recovery?: number;
  source?: 'sale' | 'proof';
}

interface DetailResponse {
  kind: 'invoices' | 'payments' | 'expenses';
  total: number;
  currency_code?: string;
  rows: DetailRow[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

/** Clic sur une carte (cahier §1) : factures, paiements ou dépenses qui la composent. */
function KpiDetailsModal({ card, label, scope, onClose }: { card: DetailCard; label: string; scope: KpiDetailsScope; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    client
      .get<DetailResponse>('/metrics/details', { params: { card, page, per_page: 25, ...scope } })
      .then((r) => { if (active) setData(r.data); })
      .catch(() => { if (active) setData(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card, page, JSON.stringify(scope)]);

  const cur = data?.currency_code;
  const openInvoice = (id?: string) => id && navigate(`/invoices/${id}`);

  return (
    <Modal isOpen onClose={onClose} title={label} maxWidth="max-w-4xl">
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : !data || data.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('dashboard.kpi.detailsEmpty')}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('dashboard.kpi.detailsTotal', { count: data.meta.total, amount: formatCurrency(data.total, cur) })}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('dashboard.kpi.detailsDate')}</th>
                  <th className="py-2 pr-3 font-medium">{data.kind === 'expenses' ? t('dashboard.kpi.detailsLabel') : t('dashboard.kpi.detailsInvoice')}</th>
                  <th className="py-2 pr-3 font-medium">{data.kind === 'expenses' ? t('dashboard.kpi.detailsCategory') : t('dashboard.kpi.detailsClient')}</th>
                  <th className="py-2 pr-3 font-medium">{t('dashboard.kpi.detailsAgency')}</th>
                  {data.kind === 'invoices' && <th className="py-2 pr-3 text-right font-medium">{t('dashboard.kpi.detailsInvoiceTotal')}</th>}
                  <th className="py-2 text-right font-medium">{t('dashboard.kpi.detailsAmount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.rows.map((row) => {
                  const invoiceId = data.kind === 'payments' ? row.invoice_id : data.kind === 'invoices' ? row.id : undefined;
                  return (
                    <tr
                      key={`${row.source ?? ''}${row.id}`}
                      onClick={() => openInvoice(invoiceId)}
                      className={invoiceId ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                    >
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{row.date ? formatDateTimeFr(row.date) : '—'}</td>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {data.kind === 'expenses' ? row.label ?? '—' : row.number ?? '—'}
                        {row.is_recovery ? <span className="ml-1 text-xs font-normal text-amber-600">({t('dashboard.kpi.detailsRecovery')})</span> : null}
                        {row.source === 'proof' ? <span className="ml-1 text-xs font-normal text-purple-600">({t('dashboard.kpi.detailsProof')})</span> : null}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{(data.kind === 'expenses' ? row.category : row.client) || '—'}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{row.agency ?? '—'}</td>
                      {data.kind === 'invoices' && <td className="py-2 pr-3 text-right text-gray-600 dark:text-gray-300">{formatCurrency(row.invoice_total ?? 0, cur)}</td>}
                      <td className="py-2 text-right font-medium text-gray-800 dark:text-gray-100">{formatCurrency(row.amount, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.meta.last_page > 1 && (
            <Pagination currentPage={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} perPage={data.meta.per_page} onPageChange={setPage} />
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Montants renvoyés par l'API (FinancialKpiService côté serveur) : mêmes
 * clés sur /stats/group, /stats/overview, /stats/country, /stats/agency et
 * /dashboard (kpis).
 */
export interface FinancialKpis {
  revenue?: number;
  payments_total?: number;
  recoveries_total?: number;
  advances_total?: number;
  outstanding?: number;
  expenses_total?: number;
  pending_validation_total?: number;
  pending_validation_count?: number;
  net_cash?: number;
  invoices_total?: number;
  average_basket?: number;
  control_ok?: boolean;
}

function Card({ label, value, sub, icon, tone, onClick }: { label: string; value: string; sub?: string; icon: ReactNode; tone: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      className={`rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900 ${onClick ? 'cursor-pointer transition hover:border-brand-200 hover:shadow-sm dark:hover:border-brand-500/30' : ''}`}
    >
      <div className="flex flex-col items-start gap-2 *:max-w-full sm:flex-row sm:items-center sm:gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
        <div className="w-full min-w-0">
          <p className="truncate text-lg font-bold text-gray-900 sm:text-2xl dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
          {sub && <p className="truncate text-xs text-gray-400" title={sub}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

/**
 * Cartes en tête de chaque tableau de bord (cahier « Corrections demandées »,
 * section 1), dans cet ordre : Chiffre d'affaires, Encaissé (dont
 * recouvrements), Acomptes, Impayés, Dépenses, En attente de validation, Net caisse.
 */
export function FinancialKpiCards({ kpis, currency, detailsScope }: { kpis: FinancialKpis | null | undefined; currency?: string | null; detailsScope?: KpiDetailsScope | null }) {
  const { t } = useTranslation();
  const money = (v?: number) => formatCurrency(v ?? 0, currency);
  const [opened, setOpened] = useState<{ card: DetailCard; label: string } | null>(null);
  // Carte cliquable seulement quand la page fournit son périmètre.
  const open = (card: DetailCard, label: string) => (detailsScope ? () => setOpened({ card, label }) : undefined);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Card
          onClick={open('revenue', t('dashboard.kpi.revenue'))}
          label={t('dashboard.kpi.revenue')}
          value={money(kpis?.revenue)}
          sub={t('dashboard.kpi.revenueSub', { count: kpis?.invoices_total ?? 0, basket: money(kpis?.average_basket) })}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <Card
          onClick={open('payments_total', t('dashboard.kpi.collected'))}
          label={t('dashboard.kpi.collected')}
          value={money(kpis?.payments_total)}
          sub={t('dashboard.kpi.collectedSub', { amount: money(kpis?.recoveries_total) })}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
        />
        <Card
          onClick={open('advances_total', t('dashboard.kpi.advances'))}
          label={t('dashboard.kpi.advances')}
          value={money(kpis?.advances_total)}
          sub={t('dashboard.kpi.advancesSub')}
          icon={<PiggyBank className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <Card
          onClick={open('outstanding', t('dashboard.kpi.outstanding'))}
          label={t('dashboard.kpi.outstanding')}
          value={money(kpis?.outstanding)}
          sub={t('dashboard.kpi.outstandingSub')}
          icon={<Clock className="h-5 w-5" />}
          tone="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <Card
          onClick={open('expenses_total', t('dashboard.kpi.expenses'))}
          label={t('dashboard.kpi.expenses')}
          value={money(kpis?.expenses_total)}
          icon={<ArrowDownCircle className="h-5 w-5" />}
          tone="bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
        />
        <Card
          onClick={open('pending_validation_total', t('dashboard.kpi.pending'))}
          label={t('dashboard.kpi.pending')}
          value={money(kpis?.pending_validation_total)}
          sub={t('dashboard.kpi.pendingSub', { count: kpis?.pending_validation_count ?? 0 })}
          icon={<Hourglass className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <Card
          label={t('dashboard.kpi.netCash')}
          value={money(kpis?.net_cash)}
          sub={t('dashboard.kpi.netCashSub')}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>
      {opened && detailsScope && (
        <KpiDetailsModal card={opened.card} label={opened.label} scope={detailsScope} onClose={() => setOpened(null)} />
      )}
      {kpis && kpis.control_ok === false && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {t('dashboard.kpi.controlKo')}
        </p>
      )}
    </div>
  );
}

export default FinancialKpiCards;
