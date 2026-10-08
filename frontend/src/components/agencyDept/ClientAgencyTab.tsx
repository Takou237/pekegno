import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { contractsApi } from '@/api/contracts.api';
import { formatCurrency } from '@/utils/number';
import { PrestationStatusBadge } from './AgencyBadges';
import { Stars } from './StarRating';
import { CONTRACT_STATUS_COLORS, CONTRACT_STATUS_LABELS, type Contract } from '@/types/contract';
import type { Prestation } from '@/types/agencyDepartment';

/** Fiche client — vue Agency : packages souscrits, prestations, contrats (§6.12). */
export function ClientAgencyTab({ clientId, departmentId, basePath }: { clientId: string; departmentId?: string; basePath: string }) {
  const { t } = useTranslation();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [prestations, setPrestations] = useState<Prestation[]>([]);

  useEffect(() => {
    contractsApi.list({ client_id: clientId, department_id: departmentId, per_page: 100 }).then((r) => setContracts(r.data)).catch(() => {});
    agencyDeptApi.prestations({ client_id: clientId, department_id: departmentId, per_page: 100 }).then((r) => setPrestations(r.data)).catch(() => {});
  }, [clientId, departmentId]);

  const packages = contracts.filter((c) => c.origin === 'package');

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Block title={t('agencyDept.clientTab.packages')}>
        {packages.length === 0 ? <Empty /> : packages.map((c) => (
          <Row key={c.id} to={`${basePath}/contracts/${c.id}`} left={c.pack?.name ?? c.number} right={<span className={`rounded-full px-2 py-0.5 text-xs ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span>} sub={`${c.start_date.slice(0, 10)} → ${c.end_date.slice(0, 10)}`} />
        ))}
      </Block>
      <Block title={t('nav.prestations')}>
        {prestations.length === 0 ? <Empty /> : prestations.map((p) => (
          <Row key={p.id} to={`${basePath}/prestations/${p.id}`} left={p.name} right={<PrestationStatusBadge status={p.status} />} sub={(() => {
            const rating = p.display_rating_avg ?? Number(p.rating_avg || 0);
            return rating ? <Stars value={rating} size="h-3 w-3" /> : formatCurrency(p.budget);
          })()} />
        ))}
      </Block>
      <Block title={t('nav.contracts')}>
        {contracts.length === 0 ? <Empty /> : contracts.map((c) => (
          <Row key={c.id} to={`${basePath}/contracts/${c.id}`} left={c.number} right={<span className={`rounded-full px-2 py-0.5 text-xs ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span>} sub={formatCurrency(c.amount)} />
        ))}
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  );
}

function Row({ to, left, right, sub }: { to: string; left: string; right: React.ReactNode; sub: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center justify-between gap-3 py-2 hover:opacity-80">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{left}</p>
        <div className="text-xs text-gray-400">{sub}</div>
      </div>
      {right}
    </Link>
  );
}

function Empty() {
  const { t } = useTranslation();
  return <p className="text-sm text-gray-400">{t('agencyDept.empty')}</p>;
}
