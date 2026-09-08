import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clientApi } from '@/api/client.api';
import { useToast } from '@/context/ToastContext';
import type { LearnerProfile, Attendance, LearnerObservation, CourseModule } from '@/types';
import { formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { CheckCircle } from 'lucide-react';

export default function LearnerPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [profile, setProfile] = useState<LearnerProfile | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [observations, setObservations] = useState<LearnerObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleId, setModuleId] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      clientApi.getLearnerProfile(),
      clientApi.getAttendances(),
      clientApi.getObservations(),
    ])
      .then(([p, a, o]) => {
        setProfile(p as LearnerProfile);
        setAttendances((a as { data?: Attendance[] }).data ?? []);
        setObservations((o as { data?: LearnerObservation[] }).data ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modules: CourseModule[] = (profile?.courses ?? []).flatMap((c) =>
    (c.modules ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      order_index: m.order_index,
      course_id: c.course.id,
    })),
  );

  const presentCount = attendances.filter((a) => a.status === 'present').length;
  const totalRecorded = (profile?.courses ?? []).reduce((sum, c) => sum + c.modules.reduce((s, m) => s + m.presences.recorded, 0), 0);
  const rate = totalRecorded > 0 ? Math.round((presentCount / Math.max(totalRecorded, attendances.length)) * 100) : attendances.length ? Math.round((presentCount / attendances.length) * 100) : 0;

  const handleSubmitObservation = async () => {
    if (!moduleId || !content.trim()) return;
    setSubmitting(true);
    try {
      await clientApi.addObservation({ course_module_id: moduleId, content });
      showToast(t('account.submitObservation'), 'success');
      setContent('');
      setModuleId('');
      const o = await clientApi.getObservations();
      setObservations((o as { data?: LearnerObservation[] }).data ?? []);
    } catch {
      showToast(t('common.error'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spinner className="py-20" />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t('account.learner')}</h1>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{t('account.attendanceRate')}</p>
          <p className="text-3xl font-bold text-gray-900">{rate}%</p>
        </div>
        <div className="flex items-center gap-2 text-success-600">
          <CheckCircle size={20} />
          <span className="text-sm font-medium">{presentCount} / {attendances.length} presences</span>
        </div>
      </div>

      {(profile?.courses ?? []).length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-4">{t('account.formations')}</h2>
          <div className="space-y-4">
            {profile?.courses.map((c) => (
              <div key={c.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">{c.course.name}</h3>
                  <Badge variant={c.status === 'active' ? 'success' : 'neutral'}>{t(`status.${c.status}`)}</Badge>
                </div>
                <div className="space-y-2">
                  {c.modules.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-700">{m.order_index ?? ''} {m.name}</span>
                      <span className="text-xs text-gray-500">
                        {m.presences.present} present / {m.presences.recorded} enregistres
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="font-semibold text-gray-900 mb-4">{t('account.observations')}</h2>
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
            <Select label={t('account.observations')} value={moduleId} onChange={(e) => setModuleId(e.target.value)}>
              <option value="">Module...</option>
              {modules.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Input label={t('account.observationContent')} value={content} onChange={(e) => setContent(e.target.value)} />
            <Button onClick={handleSubmitObservation} isLoading={submitting} disabled={!moduleId || !content.trim()} fullWidth>{t('account.submitObservation')}</Button>
          </div>

          {observations.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-gray-500 shadow-sm border border-gray-100">{t('common.noData')}</div>
          ) : (
            <div className="space-y-3">
              {observations.map((obs) => (
                <div key={obs.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">{obs.course_module?.name ?? 'Module'}</span>
                    <span className="text-xs text-gray-400">{formatDate(obs.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-600">{obs.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-4">Presences</h2>
        {attendances.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-gray-500 shadow-sm border border-gray-100">{t('common.noData')}</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Session</th>
                  <th className="px-6 py-3">Module</th>
                  <th className="px-6 py-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {attendances.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-4 text-gray-600">{a.recorded_at ? formatDate(a.recorded_at) : a.date ? formatDate(a.date) : '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{a.training_session?.course?.name ?? '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{a.training_session?.module?.name ?? a.course_module?.name ?? '-'}</td>
                    <td className="px-6 py-4">
                      <Badge variant={a.status === 'present' ? 'success' : a.status === 'late' ? 'warning' : 'error'}>{a.status}</Badge>
                    </td>
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