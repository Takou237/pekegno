import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { RatingSummaryCard } from '@/components/agencyDept/StarRating';
import { CONTRACT_STATUS_LABELS, type ContractStatus } from '@/types/contract';
import type { AgencyReport } from '@/types/agencyDepartment';

/** Rapports Agency (cahier §18) : clients, renouvellements, revenu récurrent, satisfaction. */
export default function AgencyDeptReportsPage() {
  const { t } = useTranslation();
  const { departmentId } = useAgencyDept();
  const now = new Date();
  const [from, setFrom] = useState(todayLocal(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(todayLocal());
  const [report, setReport] = useState<AgencyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!departmentId) return;
    setReport(null);
    agencyDeptApi.report({ department_id: departmentId, from, to }).then(setReport).catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, from, to, t]);

  function exportCsv() {
    if (!report) return;
    const k = report.kpis;
    const lines: (string | number | null)[][] = [
      ['Indicateur', 'Valeur'],
      ['Période', `${report.period.from} → ${report.period.to}`],
      ['CA (honoraires, hors pass-through)', k.revenue],
      ['Encaissé', k.collected],
      ['Dont budget pub client (pass-through)', k.pass_through_collected],
      ['Créances', k.receivables],
      ['Revenu récurrent mensuel (MRR)', k.mrr],
      ['Contrats actifs', k.active_contracts],
      ['Contrats à renouveler (30 j)', k.contracts_to_renew],
      ['Taux de renouvellement (%)', k.renewal_rate],
      ['Prestations en cours', k.prestations_in_progress],
      ['Actions en retard', k.overdue_actions],
      ['Note moyenne', report.rating.avg],
      [],
      ['CA par catégorie', ''],
      ...report.revenue_by_category.map((r) => [r.category, r.total]),
    ];
    const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-agency-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.reports')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.reports.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Input label={t('agencyDept.startDate')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input label={t('agencyDept.endDate')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Button variant="outline" onClick={exportCsv} disabled={!report}><Download className="h-4 w-4" /> CSV</Button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {!report ? <SkeletonDashboard /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('agencyDept.dashboard.revenue')} value={formatCurrency(report.kpis.revenue)} />
            <Stat label={t('agencyDept.dashboard.collected')} value={formatCurrency(report.kpis.collected)} />
            <Stat label={t('agencyDept.dashboard.passThrough')} value={formatCurrency(report.kpis.pass_through_collected)} />
            <Stat label={t('agencyDept.dashboard.receivables')} value={formatCurrency(report.kpis.receivables)} />
            <Stat label={t('agencyDept.dashboard.mrr')} value={formatCurrency(report.kpis.mrr)} />
            <Stat label={t('agencyDept.reports.renewalRate')} value={report.kpis.renewal_rate != null ? `${report.kpis.renewal_rate} %` : '—'} hint={`${report.kpis.renewed_contracts} / ${report.kpis.ended_contracts}`} />
            <Stat label={t('agencyDept.dashboard.activeContracts')} value={String(report.kpis.active_contracts)} />
            <Stat label={t('agencyDept.dashboard.overdueActions')} value={String(report.kpis.overdue_actions)} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title={t('agencyDept.reports.revenueByCategory')}>
              <KeyValues rows={report.revenue_by_category.map((r) => [r.category, formatCurrency(r.total)])} />
            </Panel>
            <Panel title={t('agencyDept.reports.contractsByStatus')}>
              <KeyValues rows={Object.entries(report.contracts_by_status).map(([k, v]) => [CONTRACT_STATUS_LABELS[k as ContractStatus] ?? k, String(v)])} />
            </Panel>
            <Panel title={t('agencyDept.reports.prestationsByStatus')}>
              <KeyValues rows={Object.entries(report.prestations_by_status).map(([k, v]) => [t(`agencyDept.prestationStatus.${k}`), String(v)])} />
            </Panel>
            <Panel title={t('agencyDept.dashboard.topCommercials')}>
              <KeyValues rows={report.top_commercials.map((r) => [r.name, `${r.contracts} · ${formatCurrency(r.amount)}`])} />
            </Panel>
            <Panel title={t('agencyDept.dashboard.topPackages')}>
              <KeyValues rows={report.top_packages.map((r) => [r.name, `${r.contracts} · ${formatCurrency(r.amount)}`])} />
            </Panel>
            <Panel title={t('agencyDept.dashboard.satisfaction')}>
              <RatingSummaryCard summary={report.rating} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{value}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{title}</h2>
      {children}
    </div>
  );
}

function KeyValues({ rows }: { rows: string[][] }) {
  const { t } = useTranslation();
  if (rows.length === 0) return <p className="text-sm text-gray-400">{t('agencyDept.empty')}</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3"><span className="text-gray-600 dark:text-gray-300">{k}</span><span className="font-medium text-gray-900 dark:text-white">{v}</span></li>
      ))}
    </ul>
  );
}
