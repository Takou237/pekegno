import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Briefcase, CalendarDays, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import type { TeamMission, TeamMissionAction } from '@/types/agencyDepartment';

/**
 * Tableau de bord du community-manager : son travail d'équipier (prestations
 * assignées et actions à faire). Depuis la décision T0.6, il n'est plus
 * vendeur : ses droits ne couvrent ni ventes ni factures.
 */
export default function CommunityManagerDashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [missions, setMissions] = useState<TeamMission[]>([]);
  const [actions, setActions] = useState<TeamMissionAction[]>([]);
  const [openActions, setOpenActions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    agencyDeptApi
      .teamMissions()
      .then((team) => {
        if (!active) return;
        setMissions(team.prestations);
        setActions(team.actions);
        setOpenActions(team.open_actions);
      })
      .catch((error) => {
        if (active) setError(extractErrorMessage(error, t('common.error')));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  if (loading) return <SkeletonDetail />;

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || '';

  const kpis = [
    { icon: Briefcase, label: t('agencyDept.team.myPrestations'), value: String(missions.length) },
    { icon: ClipboardCheck, label: t('agencyDept.team.myActions'), value: String(openActions) },
  ];

  const upcoming = actions.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercial.selfTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fullName} — {t('commercial.cmSubtitle')}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center gap-2">
              <k.icon className="h-4 w-4 text-brand-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">{k.label}</p>
            </div>
            <p className="mt-2 text-lg font-semibold text-gray-900 dark:text-white sm:text-2xl">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6">
        <section className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('commercial.cmUpcomingActions')}</h2>
            <Link to="/team/tracking" className="text-sm font-medium text-brand-600 hover:underline">
              {t('commercial.cmViewTracking')}
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-green-500" />
              {t('agencyDept.team.noActions')}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {upcoming.map((a) => {
                const to = a.prestation ? `/team/prestations/${a.prestation.id}/actions/${a.id}` : '/team/tracking';
                return (
                  <li
                    key={a.id}
                    onClick={() => navigate(to)}
                    className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-gray-900 dark:text-white">{a.title}</p>
                      <p className="truncate text-xs text-gray-400">
                        {a.prestation?.name ?? '—'} · {t(`agencyDept.actionStatus.${a.status}`)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1 text-xs ${
                        a.is_overdue ? 'font-medium text-red-600' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      <CalendarDays className="h-3.5 w-3.5" />
                      {a.due_date ? a.due_date.slice(0, 10) : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {missions.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {t('agencyDept.team.myPrestations')}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {missions.slice(0, 6).map((p) => (
              <Link
                key={p.id}
                to={`/team/prestations/${p.id}`}
                className="flex flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-4 transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="truncate font-semibold text-gray-900 dark:text-white">{p.name}</p>
                <p className="truncate text-xs text-gray-400">
                  {p.reference}
                  {p.client ? ` · ${p.client}` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
