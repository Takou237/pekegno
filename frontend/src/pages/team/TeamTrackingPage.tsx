import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { canUpdateActionExecution } from '@/utils/agencyDeptPermissions';
import { Alert } from '@/components/ui/Alert';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { ACTION_STATUSES, type PrestationStatus, type TeamMission, type TeamMissionAction } from '@/types/agencyDepartment';

/**
 * Suivi de l'équipier connecté (rôle community-manager) : ses prestations
 * et ses actions à faire, avec avancement des statuts.
 */
export default function TeamTrackingPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const canExecute = canUpdateActionExecution(user);

  const [missions, setMissions] = useState<TeamMission[]>([]);
  const [actions, setActions] = useState<TeamMissionAction[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    agencyDeptApi
      .teamMissions()
      .then((res) => {
        setMissions(res.prestations);
        setActions(res.actions);
        setOpenCount(res.open_actions);
      })
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(action: TeamMissionAction, status: string) {
    setUpdatingId(action.id);
    try {
      await agencyDeptApi.actionStatus(action.id, status);
      showToast(t('agencyDept.prestations.statusChanged'), 'success');
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('agencyDept.team.myMissions')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.team.myMissionsSubtitle')}</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <SkeletonCards />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs uppercase text-gray-400">{t('agencyDept.team.myPrestations')}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{missions.length}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs uppercase text-gray-400">{t('agencyDept.team.myActions')}</p>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{openCount}</p>
            </div>
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('agencyDept.team.myActions')}
            </h2>
            {actions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
                {t('agencyDept.team.noActions')}
              </p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="px-4 py-3 font-medium">{t('agencyDept.actions.title')}</th>
                        <th className="px-4 py-3 font-medium">{t('agencyDept.prestation')}</th>
                        <th className="px-4 py-3 font-medium">{t('agencyDept.actions.dueDate')}</th>
                        <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {actions.map((a) => {
                        const detailTo = a.prestation
                          ? `/team/prestations/${a.prestation.id}/actions/${a.id}`
                          : null;
                        return (
                        <tr
                          key={a.id}
                          className={detailTo ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''}
                          onClick={() => detailTo && navigate(detailTo)}
                        >
                          <td className="px-4 py-3">
                            {detailTo ? (
                              <Link to={detailTo} className="font-medium text-gray-900 hover:underline dark:text-white" onClick={(e) => e.stopPropagation()}>
                                {a.title}
                              </Link>
                            ) : (
                              <p className="font-medium text-gray-900 dark:text-white">{a.title}</p>
                            )}
                            <p className="text-xs text-gray-400">{t(`agencyDept.actionType.${a.type}`)}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                            {a.prestation?.name ?? '—'}
                            <p className="text-xs text-gray-400">{a.prestation?.reference ?? ''}</p>
                          </td>
                          <td className={`px-4 py-3 whitespace-nowrap ${a.is_overdue ? 'font-medium text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {a.due_date ? a.due_date.slice(0, 10) : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            {canExecute ? (
                              <select
                                value={a.status}
                                disabled={updatingId !== null}
                                onChange={(e) => changeStatus(a, e.target.value)}
                                className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-gray-700 dark:text-white"
                              >
                                {ACTION_STATUSES.map((s) => (
                                  <option key={s} value={s}>{t(`agencyDept.actionStatus.${s}`)}</option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-500">{t(`agencyDept.actionStatus.${a.status}`)}</span>
                            )}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t('agencyDept.team.myPrestations')}
            </h2>
            {missions.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-700">
                {t('agencyDept.team.noMissions')}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {missions.map((p) => {
                  const detailTo = `/team/prestations/${p.id}`;
                  return (
                  <div
                    key={p.id}
                    onClick={() => navigate(detailTo)}
                    className="flex cursor-pointer flex-col gap-2 rounded-2xl border border-gray-100 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-white">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.reference}{p.client ? ` · ${p.client}` : ''}</p>
                      </div>
                      <PrestationStatusBadge status={p.status as PrestationStatus} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {p.agency ?? ''}
                      {p.start_date ? ` · ${p.start_date.slice(0, 10)}` : ''}
                      {p.end_date ? ` → ${p.end_date.slice(0, 10)}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.roles.map((r, i) => (
                        <span key={i} className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                          {r.is_lead ? `${t('agencyDept.team.lead')} · ` : ''}{r.role ?? '—'}
                        </span>
                      ))}
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
