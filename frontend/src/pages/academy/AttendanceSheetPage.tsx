import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { client } from '@/api/client';
import { attendancesApi } from '@/api/attendances.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { attendanceStatusLabel, type AttendanceStatus, type Attendance } from '@/types/attendance';
import type { TrainingSession } from '@/api/academy.api';

interface EnrollmentRow {
  id: string;
  learnerName: string;
}

const STATUSES: AttendanceStatus[] = ['present', 'absent', 'late', 'excused'];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'text-green-600 dark:text-green-400',
  absent: 'text-red-600 dark:text-red-400',
  late: 'text-amber-600 dark:text-amber-400',
  excused: 'text-blue-600 dark:text-blue-400',
};

export default function AttendanceSheetPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionRes, enrollmentsRes, attendancesRes] = await Promise.all([
        client.get(`/training-sessions/${sessionId}`),
        client.get(`/training-sessions/${sessionId}/enrollments`),
        attendancesApi.list(sessionId).catch(() => [] as Attendance[]),
      ]);

      const sessionData: TrainingSession = sessionRes.data.data ?? sessionRes.data;
      setSession(sessionData);

      const enrollmentRows: EnrollmentRow[] = (enrollmentsRes.data.data ?? enrollmentsRes.data).map(
        (e: { id: string; learner?: { first_name: string; last_name: string } }) => ({
          id: e.id,
          learnerName: e.learner
            ? [e.learner.first_name, e.learner.last_name].filter(Boolean).join(' ') || '—'
            : '—',
        }),
      );
      setEnrollments(enrollmentRows);

      const existingMap: Record<string, AttendanceStatus> = {};
      for (const att of attendancesRes) {
        existingMap[att.enrollment_id] = att.status;
      }

      const initial: Record<string, AttendanceStatus> = {};
      for (const enr of enrollmentRows) {
        initial[enr.id] = existingMap[enr.id] ?? 'present';
      }
      setRecords(initial);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('common.error')));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function setStatus(enrollmentId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [enrollmentId]: status }));
  }

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    for (const enr of enrollments) {
      next[enr.id] = status;
    }
    setRecords(next);
  }

  async function handleSave() {
    if (!sessionId) return;
    setSaving(true);
    try {
      const items = Object.entries(records).map(([enrollment_id, status]) => ({
        enrollment_id,
        status,
      }));
      await attendancesApi.bulkUpdate(sessionId, items);
      showToast(t('common.saved'), 'success');
      loadData();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(records).filter((s) => s === 'present').length;
  const totalCount = enrollments.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  if (isLoading) {
    return <SkeletonTable rows={5} />;
  }

  if (loadError || !session) {
    return <p className="p-6 text-sm text-error-500">{loadError ?? t('common.error')}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mb-2 flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('nav.sessions')}
          </button>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('academy.attendanceSheet')}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {session.course?.name ?? '—'} —{' '}
            {new Date(session.start_at).toLocaleDateString()}
          </p>
        </div>
        <Button onClick={handleSave} isLoading={saving}>
          <Save className="h-4 w-4" />
          {t('common.save')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.attendanceRate')}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{attendanceRate}%</p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700" />
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.presentCount')}</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {presentCount} / {totalCount}
            </p>
          </div>
          <div className="h-10 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAll(s)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {attendanceStatusLabel(s, t)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {enrollments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noEnrollments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('nav.learners')}</th>
                  {STATUSES.map((s) => (
                    <th key={s} className="px-5 py-3 text-center font-medium">
                      {attendanceStatusLabel(s, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enrollments.map((enr) => (
                  <tr key={enr.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {enr.learnerName}
                    </td>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-5 py-3 text-center">
                        <input
                          type="radio"
                          name={`att-${enr.id}`}
                          checked={records[enr.id] === s}
                          onChange={() => setStatus(enr.id, s)}
                          className={`h-4 w-4 accent-current ${STATUS_COLORS[s]}`}
                        />
                      </td>
                    ))}
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
