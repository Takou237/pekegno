import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { client } from '@/api/client';
import { Modal } from '@/components/ui/Modal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type SessionStatus, type TrainingSession } from '@/api/academy.api';
import { extractErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const STATUS_COLORS: Record<SessionStatus, string> = {
  planned: 'bg-blue-100 text-blue-700 border-blue-200',
  ongoing: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200 line-through',
};

const STATUS_KEYS: Record<SessionStatus, string> = {
  planned: 'academy.statusPlanned',
  ongoing: 'academy.statusOngoing',
  completed: 'academy.statusCompletedSession',
  cancelled: 'academy.statusCancelled',
};

/** Une entrée du calendrier : début, fin ou séance (appel fait) d'une session. */
interface PlanningEvent {
  session: TrainingSession;
  kind: 'start' | 'end' | 'seance';
  date: string; // AAAA-MM-JJ pour une séance
  present?: number;
  total?: number;
  moduleName?: string | null;
}

interface SeanceRow {
  id: string;
  seances: { date: string | null; module_name: string | null; present: number; total: number }[];
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString(currentLocale(), { month: 'long', year: 'numeric' });
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(currentLocale(), { hour: '2-digit', minute: '2-digit' });
}

export default function AcademyPlanningPage() {
  const { t } = useTranslation();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const { departmentId } = useParams<{ departmentId?: string }>();
  const [seanceRows, setSeanceRows] = useState<SeanceRow[]>([]);
  const [openDay, setOpenDay] = useState<Date | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [response, seances] = await Promise.all([
        academyApi.sessions({ agency_id: agencyId, per_page: 200 }),
        client.get('/attendances/seances', { params: { agency_id: agencyId, per_page: 100 } }).then((r) => r.data.data as SeanceRow[]).catch(() => []),
      ]);
      setSessions(response.data);
      setSeanceRows(seances);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const monthStart = useMemo(() => {
    const d = new Date(cursor);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [cursor]);

  const gridStart = useMemo(() => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [monthStart]);

  const days = useMemo(() => {
    const list: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      list.push(d);
    }
    return list;
  }, [gridStart]);

  // Calendrier : début et fin de chaque session, et chaque séance où l'appel
  // a été fait (date réelle du cours) — pas la session répétée chaque jour.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, PlanningEvent[]>();
    const push = (date: Date, event: PlanningEvent) => {
      const key = startOfDay(date).toDateString();
      map.set(key, [...(map.get(key) ?? []), event]);
    };
    const byId = new Map(sessions.map((s) => [s.id, s]));
    sessions.forEach((session) => {
      push(new Date(session.start_at), { session, kind: 'start', date: session.start_at });
      if (session.end_at && startOfDay(new Date(session.end_at)).getTime() !== startOfDay(new Date(session.start_at)).getTime()) {
        push(new Date(session.end_at), { session, kind: 'end', date: session.end_at });
      }
    });
    seanceRows.forEach((row) => {
      const session = byId.get(row.id);
      if (!session) return;
      row.seances.forEach((seance) => {
        if (!seance.date) return;
        push(new Date(`${seance.date}T12:00:00`), { session, kind: 'seance', date: seance.date, present: seance.present, total: seance.total, moduleName: seance.module_name });
      });
    });
    return map;
  }, [sessions, seanceRows]);

  const sheetLink = (event: PlanningEvent) =>
    `/departments/${departmentId}/sessions/${event.session.id}/attendances${event.kind === 'seance' ? `?date=${event.date}` : ''}`;

  const eventLabel = (event: PlanningEvent) =>
    event.kind === 'start'
      ? `${formatEventTime(event.session.start_at)} ${t('academy.planningStart')}`
      : event.kind === 'end'
        ? t('academy.planningEnd')
        : `${t('academy.planningSeance')} ${event.present ?? 0}/${event.total ?? 0}`;

  const isToday = (date: Date) => date.toDateString() === startOfDay(new Date()).toDateString();
  const isCurrentMonth = (date: Date) => date.getMonth() === monthStart.getMonth();

  function goPrev() {
    setCursor((prev) => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }

  function goNext() {
    setCursor((prev) => {
      const d = new Date(prev);
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }

  function goToday() {
    setCursor(startOfDay(new Date()));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.planning')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.planningSubtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t('academy.previousMonth')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t('academy.today')}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            title={t('academy.nextMonth')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold text-gray-800 capitalize dark:text-gray-100">
          {formatMonth(monthStart)}
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-300">
          {(Object.keys(STATUS_COLORS) as SessionStatus[]).map((status) => (
            <span key={status} className="inline-flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[status].split(' ')[0]}`} />
              {t(STATUS_KEYS[status])}
            </span>
          ))}
        </div>
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-800">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-gray-400"
            >
              {t(`academy.weekday.${day}`)}
            </div>
          ))}
        </div>

        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : (
          <div className="grid grid-cols-7">
            {days.map((date) => {
              const key = date.toDateString();
              const daySessions = eventsByDay.get(key) ?? [];
              return (
                <div
                  key={key}
                  className={`min-h-28 border-b border-gray-100 p-1.5 dark:border-gray-800 ${
                    date.getDay() !== 0 ? 'border-r dark:border-gray-800' : ''
                  } ${isCurrentMonth(date) ? 'bg-white dark:bg-gray-900' : 'bg-gray-50 dark:bg-gray-950'}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday(date)
                          ? 'bg-brand-600 text-white'
                          : isCurrentMonth(date)
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'text-gray-400 dark:text-gray-600'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {daySessions.length > 0 && (
                      <span className="text-[10px] font-medium text-gray-400">
                        {daySessions.length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    {daySessions.slice(0, 3).map((event, idx) => (
                      <Link
                        key={`${event.session.id}-${event.kind}-${idx}`}
                        to={sheetLink(event)}
                        className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${STATUS_COLORS[event.session.status]}`}
                        title={event.session.course?.name ?? ''}
                      >
                        <span className="font-mono">{eventLabel(event)}</span>{' '}
                        <span className="line-clamp-1">{event.session.course?.name ?? event.session.course?.code ?? ''}</span>
                      </Link>
                    ))}
                    {daySessions.length > 3 && (
                      <button type="button" onClick={() => setOpenDay(date)} className="px-1 text-left text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-300">
                        +{daySessions.length - 3} {t('academy.moreEvents')}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Modal
        isOpen={Boolean(openDay)}
        onClose={() => setOpenDay(null)}
        title={openDay ? openDay.toLocaleDateString(currentLocale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        maxWidth="max-w-lg"
      >
        <ul className="flex flex-col gap-2">
          {(openDay ? eventsByDay.get(startOfDay(openDay).toDateString()) ?? [] : []).map((event, idx) => (
            <li key={`${event.session.id}-${event.kind}-${idx}`}>
              <Link
                to={sheetLink(event)}
                onClick={() => setOpenDay(null)}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${STATUS_COLORS[event.session.status]}`}
              >
                <span className="font-medium">{event.session.course?.name ?? '—'}</span>
                <span className="shrink-0 text-xs">
                  {eventLabel(event)}
                  {event.moduleName ? ` · ${event.moduleName}` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
