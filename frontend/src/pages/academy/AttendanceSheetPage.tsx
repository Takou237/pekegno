import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Save, ArrowLeft, Download, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { client } from '@/api/client';
import { attendancesApi } from '@/api/attendances.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import {
  attendanceStatusLabel,
  type AttendanceRosterItem,
  type AttendanceStatus,
} from '@/types/attendance';
import type { TrainingSession } from '@/api/academy.api';

const STATUSES: AttendanceStatus[] = ['present', 'absent'];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'text-green-600 dark:text-green-400',
  absent: 'text-red-600 dark:text-red-400',
};

export default function AttendanceSheetPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [session, setSession] = useState<TrainingSession | null>(null);
  const [roster, setRoster] = useState<AttendanceRosterItem[]>([]);
  const [records, setRecords] = useState<Record<string, AttendanceStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!sessionId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sessionRes, attendances] = await Promise.all([
        client.get(`/training-sessions/${sessionId}`),
        attendancesApi.list(sessionId),
      ]);

      const sessionData: TrainingSession = sessionRes.data.data ?? sessionRes.data;
      setSession(sessionData);
      setRoster(attendances);

      const initial: Record<string, AttendanceStatus> = {};
      for (const item of attendances) {
        initial[item.learner_user_id] = item.status === 'absent' ? 'absent' : 'present';
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

  function setStatus(learnerUserId: string, status: AttendanceStatus) {
    setRecords((prev) => ({ ...prev, [learnerUserId]: status }));
  }

  function setAll(status: AttendanceStatus) {
    const next: Record<string, AttendanceStatus> = {};
    for (const item of roster) {
      next[item.learner_user_id] = status;
    }
    setRecords(next);
  }

  async function handleSave() {
    if (!sessionId) return;
    setSaving(true);
    try {
      const items = roster.map((item) => ({
        learner_user_id: item.learner_user_id,
        status: records[item.learner_user_id] ?? (item.status === 'absent' ? 'absent' : 'present'),
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
  const totalCount = roster.length;
  const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  function handleExport() {
    if (!session) return;
    const statusLabelMap = (s: AttendanceStatus) => attendanceStatusLabel(s, t);
    const rows = [
      [t('nav.learners'), ...STATUSES.map(statusLabelMap)],
      ...roster.map((item) => [
        item.learner ? [item.learner.first_name, item.learner.last_name].filter(Boolean).join(' ') : '—',
        ...STATUSES.map((s) => (records[item.learner_user_id] === s ? 'X' : '')),
      ]),
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('academy.attendanceSheet').replace(/\s+/g, '-')}-${session.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
            {session.course?.name ?? '—'}
            {session.module?.name ? ` · ${session.module.name}` : ''} —{' '}
            {new Date(session.start_at).toLocaleString()}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
            {session.trainer && (
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-gray-400" />
                {[session.trainer.first_name, session.trainer.last_name].filter(Boolean).join(' ') || session.trainer.email}
              </span>
            )}
            {session.end_at && (
              <span>
                {t('academy.endAt')}: {new Date(session.end_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={roster.length === 0}>
            <Download className="h-4 w-4" />
            {t('common.export')}
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            <Save className="h-4 w-4" />
            {t('common.save')}
          </Button>
        </div>
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
        {roster.length === 0 ? (
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
                {roster.map((item) => (
                  <tr key={item.learner_user_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {item.learner ? [item.learner.first_name, item.learner.last_name].filter(Boolean).join(' ') || '—' : '—'}
                    </td>
                    {STATUSES.map((s) => (
                      <td key={s} className="px-5 py-3 text-center">
                        <input
                          type="radio"
                          name={`att-${item.learner_user_id}`}
                          checked={records[item.learner_user_id] === s}
                          onChange={() => setStatus(item.learner_user_id, s)}
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