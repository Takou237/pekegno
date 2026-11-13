import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, ClipboardList, RefreshCw } from 'lucide-react';
import { client } from '@/api/client';
import { currentLocale } from '@/i18n';
import { Button } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';

interface Seance {
  date: string | null;
  module_id: string | null;
  module_name: string | null;
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  recorded_at: string | null;
  recorded_by: string | null;
}

interface SessionSeances {
  id: string;
  course: { id: string; name: string; code: string } | null;
  agency: string | null;
  trainer: string | null;
  start_at: string | null;
  end_at: string | null;
  status: string;
  seances: Seance[];
}

const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  ongoing: 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-300',
  completed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

function day(value: string | null): string {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString(currentLocale(), { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Présences par séance (MVP §10, CdC §7) : pour chaque session, ses séances
 * datées et l'appel fait (présents, absents, retards, par qui) ; bouton pour
 * faire l'appel du jour ou rouvrir une séance.
 */
export default function SessionSeancesPage() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { departmentId } = useParams<{ departmentId?: string }>();
  const context = useOutletContext<{ agencyId?: string } | undefined>();
  const asTrainer = pathname.startsWith('/formateur') || pathname.startsWith('/mes-formations');
  const base = pathname.startsWith('/mes-formations') ? '/mes-formations' : pathname.startsWith('/formateur') ? '/formateur' : `/departments/${departmentId}`;

  const [rows, setRows] = useState<SessionSeances[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; per_page: number } | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    client
      .get('/attendances/seances', {
        params: { page, per_page: 10, as_trainer: asTrainer ? 1 : undefined, agency_id: !asTrainer ? context?.agencyId : undefined },
      })
      .then(({ data }) => {
        setRows(data.data);
        setMeta(data.meta);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [page, asTrainer, context?.agencyId]);

  useEffect(() => {
    load();
  }, [load]);

  const sheet = (sessionId: string, date?: string | null, moduleId?: string | null) => {
    const params = new URLSearchParams();
    if (date) params.set('date', date);
    if (moduleId) params.set('module', moduleId);
    const qs = params.toString();
    return `${base}/sessions/${sessionId}/attendances${qs ? `?${qs}` : ''}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.presences')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.seancesSubtitle')}</p>
        </div>
        <Button variant="outline" onClick={load}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <SkeletonTable rows={5} />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">{t('academy.noSessions')}</p>
      ) : (
        rows.map((s) => (
          <div key={s.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{s.course?.name ?? '—'}</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {day(s.start_at)} → {s.end_at ? day(s.end_at) : t('academy.noEndDate')}
                  {s.trainer && ` · ${s.trainer}`}
                  {s.agency && ` · ${s.agency}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[s.status] ?? STATUS_STYLES.completed}`}>
                  {t(`academy.status_${s.status}`, { defaultValue: s.status })}
                </span>
                <Link to={sheet(s.id)}>
                  <Button size="sm">
                    <ClipboardCheck className="h-4 w-4" />
                    {t('academy.takeRollCall')}
                  </Button>
                </Link>
              </div>
            </div>

            {s.seances.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">{t('academy.noSeance')}</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="py-2 pr-3 font-medium">{t('academy.seanceDate')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.module')}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('academy.present')}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('academy.absent')}</th>
                      <th className="py-2 pr-3 text-right font-medium">{t('academy.late')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.rollCallBy')}</th>
                      <th className="py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {s.seances.map((seance) => (
                      <tr key={`${seance.date}-${seance.module_id ?? 'all'}`}>
                        <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{day(seance.date)}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{seance.module_name ?? t('academy.allModules')}</td>
                        <td className="py-2 pr-3 text-right text-green-600">{seance.present}</td>
                        <td className="py-2 pr-3 text-right text-red-500">{seance.absent}</td>
                        <td className="py-2 pr-3 text-right text-amber-600">{seance.late}</td>
                        <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">
                          {seance.recorded_by ?? '—'}
                          {seance.recorded_at && <span className="block text-xs">{new Date(seance.recorded_at).toLocaleString(currentLocale(), { dateStyle: 'short', timeStyle: 'short' })}</span>}
                        </td>
                        <td className="py-2 text-right">
                          <Link to={sheet(s.id, seance.date, seance.module_id)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">
                            <ClipboardList className="h-3.5 w-3.5" />
                            {t('academy.openSeance')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))
      )}

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={meta.per_page} onPageChange={setPage} />
      )}
    </div>
  );
}
