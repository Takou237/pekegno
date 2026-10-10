import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import TeamDirectoryTab from '@/components/agencyDept/TeamDirectoryTab';
import { personName, type ClientTeamRole, type TeamOverviewRow } from '@/types/agencyDepartment';

/**
 * Équipe client (§6.7) : tous les employés affectés aux prestations, leurs
 * rôles Agency (≠ rôles applicatifs), leurs prestations / clients et leur charge.
 */
export default function ClientTeamPage() {
  const { t } = useTranslation();
  const { departmentId, agencyId, basePath } = useAgencyDept();
  const [tab, setTab] = useState<'assignments' | 'directory'>('assignments');
  const [rows, setRows] = useState<TeamOverviewRow[] | null>(null);
  const [roles, setRoles] = useState<ClientTeamRole[]>([]);
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!departmentId) return;
    agencyDeptApi
      .teamOverview({ department_id: departmentId, client_team_role_id: roleId || undefined })
      .then(setRows)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, roleId, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    agencyDeptApi.teamRoles({ department_id: departmentId }).then(setRoles).catch(() => {});
  }, [departmentId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.clientTeam')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.team.subtitle')}</p>
        </div>
        {tab === 'assignments' && (
          <Select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
            <option value="">{t('agencyDept.team.allRoles')}</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        )}
      </div>

      <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800">
        {(['assignments', 'directory'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {t(id === 'assignments' ? 'agencyDept.team.assignmentsTab' : 'agencyDept.team.directoryTab')}
          </button>
        ))}
      </div>

      {tab === 'directory' ? (
        <TeamDirectoryTab agencyId={agencyId} departmentId={departmentId} />
      ) : (
        <>
      {error && <Alert variant="error">{error}</Alert>}

      {!rows ? (
        <SkeletonTable />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">{t('agencyDept.team.empty')}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.user.id} className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{personName(row.user)}</p>
                  <p className="text-xs text-gray-400">{row.user.email}</p>
                </div>
                <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {t('agencyDept.team.openActions', { count: row.open_actions })}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {row.roles.map((r) => (
                  <span key={r.id} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{r.name}</span>
                ))}
              </div>
              <ul className="flex flex-col gap-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-800">
                {row.prestations.map((p) => (
                  <li key={`${p.id}-${p.role}`} className="flex items-center justify-between gap-2">
                    <Link to={`${basePath}/prestations/${p.id}`} className="min-w-0 truncate text-gray-700 hover:underline dark:text-gray-200">
                      {p.is_lead && <Crown className="mr-1 inline h-3.5 w-3.5 text-amber-500" />}
                      {p.name} <span className="text-xs text-gray-400">· {p.client ?? '—'}{p.role ? ` · ${p.role}` : ''}</span>
                    </Link>
                    <PrestationStatusBadge status={p.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
