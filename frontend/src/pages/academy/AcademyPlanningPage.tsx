import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
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

  const fetchSessions = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.sessions({ agency_id: agencyId, per_page: 200 });
      setSessions(response.data);
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

  const sessionsByDay = useMemo(() => {
    const map = new Map<string, TrainingSession[]>();
    sessions.forEach((session) => {
      const key = startOfDay(new Date(session.start_at)).toDateString();
      const bucket = map.get(key) ?? [];
      bucket.push(session);
      map.set(key, bucket);
    });
    map.forEach((bucket) => {
      bucket.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
    });
    return map;
  }, [sessions]);

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
              const daySessions = sessionsByDay.get(key) ?? [];
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
                    {daySessions.slice(0, 3).map((session) => (
                      <Link
                        key={session.id}
                        to={`sessions/${session.id}/attendances`}
                        className={`rounded-md border px-1.5 py-1 text-[11px] leading-tight ${STATUS_COLORS[session.status]}`}
                        title={session.course?.name ?? ''}
                      >
                        <span className="font-mono">{formatEventTime(session.start_at)}</span>{' '}
                        <span className="line-clamp-1">{session.course?.name ?? session.course?.code ?? ''}</span>
                      </Link>
                    ))}
                    {daySessions.length > 3 && (
                      <span className="px-1 text-[11px] font-medium text-gray-500">
                        +{daySessions.length - 3} {t('academy.moreEvents')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
