import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CalendarClock,
  BookOpen,
  Wallet,
  Clock,
  UserCheck,
  BadgeCheck,
  Mail,
  Phone,
  Users,
  Award,
  MessageSquare,
  Trash2,
  CalendarCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type LearnerEnrollmentItem, type LearnerStats } from '@/api/academy.api';
import { certificatesApi } from '@/api/certificates.api';
import { extractErrorMessage } from '@/api/errors';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';
import type { Certificate } from '@/types/certificate';

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="truncate text-sm text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EnrollmentTable({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: LearnerEnrollmentItem[];
  emptyLabel: string;
}) {
  const { t } = useTranslation();

  function statusBadge(status: LearnerEnrollmentItem['status']) {
    if (status === 'completed') return <Badge variant="success">{t('academy.statusCompleted')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
    return <Badge variant="brand">{t('academy.statusEnrolled')}</Badge>;
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {icon}
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="pb-2 pr-4 font-medium">{t('nav.courses')}</th>
                <th className="pb-2 pr-4 font-medium">{t('nav.trainers')}</th>
                <th className="pb-2 pr-4 font-medium">{t('academy.sessionDate')}</th>
                <th className="pb-2 font-medium">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">
                    {item.course?.name ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {item.trainer ?? '—'}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {item.start_at
                      ? new Date(item.start_at).toLocaleString(currentLocale(), {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="py-2.5">{statusBadge(item.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AcademyLearnerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { learnerId } = useParams<{ learnerId: string }>();
  const { showToast } = useToast();
  const [data, setData] = useState<LearnerStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [observations, setObservations] = useState<{ id: string; content: string; created_at: string }[]>([]);
  const [newObs, setNewObs] = useState('');
  const [addingObs, setAddingObs] = useState(false);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  useEffect(() => {
    if (!learnerId) return;
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    Promise.all([
      academyApi.learnerStats(learnerId),
      academyApi.learnerObservations({ learner_user_id: learnerId, per_page: 10 }).catch(() => ({ data: [] })),
      certificatesApi.list({ per_page: 50 }).catch(() => ({ data: [] as Certificate[], current_page: 1, last_page: 1, per_page: 50, total: 0 })),
    ])
      .then(([statsRes, obsRes, certRes]) => {
        if (!active) return;
        setData(statsRes);
        setObservations(obsRes.data as { id: string; content: string; created_at: string }[]);
        setCertificates(certRes.data as Certificate[]);
      })
      .catch((error) => {
        if (active) setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [learnerId, t]);

  async function handleAddObservation() {
    if (!learnerId || !newObs.trim()) return;
    setAddingObs(true);
    try {
      const created = await academyApi.createLearnerObservation({ learner_user_id: learnerId, content: newObs.trim() });
      setObservations((prev) => [created as { id: string; content: string; created_at: string }, ...prev]);
      setNewObs('');
      showToast(t('common.saved'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.saveFailed')), 'error');
    } finally { setAddingObs(false); }
  }

  async function handleDeleteObservation(id: string) {
    if (!window.confirm(t('common.confirmDelete'))) return;
    try {
      await academyApi.removeLearnerObservation(id);
      setObservations((prev) => prev.filter((o) => o.id !== id));
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  if (isLoading) return <SkeletonDashboard />;

  if (loadError || !data) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('nav.learners')}
        </button>
        <p className="text-sm text-error-500">{loadError ?? t('academy.loadFailed')}</p>
      </div>
    );
  }

  const { learner, stats } = data;
  const fullName =
    [learner.first_name, learner.last_name].filter(Boolean).join(' ') || learner.email;
  const initials =
    [learner.first_name, learner.last_name]
      .filter((part): part is string => Boolean(part))
      .map((part) => part.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || '?';

  const statusBars = [
    { key: 'enrolled' as const, label: t('academy.statusEnrolled'), color: 'bg-brand-500' },
    { key: 'completed' as const, label: t('academy.statusCompleted'), color: 'bg-success-500' },
    { key: 'cancelled' as const, label: t('academy.statusCancelled'), color: 'bg-error-500' },
  ];

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex w-fit items-center gap-2 text-sm text-gray-500 hover:text-brand-600 dark:text-gray-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('nav.learners')}
      </button>

      {/* Profil apprenant */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sky-50 text-lg font-semibold text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{fullName}</h1>
              {learner.client_number && (
                <Badge variant="neutral">{learner.client_number}</Badge>
              )}
              {learner.is_active ? (
                <Badge variant="success">
                  <BadgeCheck className="mr-1 h-3 w-3" />
                  {t('common.active')}
                </Badge>
              ) : (
                <Badge variant="neutral">{t('common.inactive')}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {learner.email}
              </span>
              {learner.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  {learner.phone}
                </span>
              )}
              {learner.created_at && (
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  {t('academy.memberSince')} {new Date(learner.created_at).toLocaleDateString(currentLocale(), { dateStyle: 'medium' })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={t('academy.enrollmentsTotal')}
          value={stats.enrollments_total}
          icon={<CalendarDays className="h-5 w-5" />}
          tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
        />
        <StatCard
          label={t('academy.coursesTaken')}
          value={stats.courses_unique}
          icon={<BookOpen className="h-5 w-5" />}
          tone="bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
        />
        <StatCard
          label={t('academy.trainersUnique')}
          value={stats.trainers_unique ?? '—'}
          icon={<Users className="h-5 w-5" />}
          tone="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
        />
        <StatCard
          label={t('academy.sessionsUpcoming')}
          value={stats.sessions_upcoming}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400"
        />
        <StatCard
          label={t('academy.totalInvested')}
          value={formatCurrency(stats.total_invested)}
          icon={<Wallet className="h-5 w-5" />}
          tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
        />
      </div>

      {/* Métriques détaillées + barres de progression */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t('academy.metricsTitle')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('academy.enrollmentsCompleted')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.enrollments_by_status.completed}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <UserCheck className="h-3.5 w-3.5" />
              {t('academy.attendanceCount')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.attendance_count}
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <BadgeCheck className="h-3.5 w-3.5" />
              {t('academy.completionRate')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.completion_rate}%
            </p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase text-gray-400">
              <Clock className="h-3.5 w-3.5" />
              {t('academy.hoursCompleted')}
            </p>
            <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">
              {stats.hours_completed} {t('academy.hours')}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          {statusBars.map(({ key, label, color }) => {
            const count = stats.enrollments_by_status[key] ?? 0;
            const percent =
              stats.enrollments_total > 0 ? Math.round((count / stats.enrollments_total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-xs text-gray-500 dark:text-gray-400">{label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-xs font-medium text-gray-700 dark:text-gray-200">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Certificats obtenus */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <Award className="h-4 w-4" />
          {t('certificates.title')} ({certificates.length})
        </h2>
        {certificates.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noCertificates')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {certificates.map((cert) => (
              <div
                key={cert.id}
                className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 dark:border-green-700/50 dark:bg-green-900/20"
              >
                <Award className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300">
                    {cert.enrollment?.course?.name ?? cert.number}
                  </p>
                  <p className="text-[10px] text-green-600/70 dark:text-green-400/70">
                    {cert.number} · {new Date(cert.issued_on).toLocaleDateString(currentLocale(), { dateStyle: 'medium' })}
                    {cert.mention && ` · ${cert.mention}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Observations */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          <MessageSquare className="h-4 w-4" />
          {t('academy.observations')}
        </h2>
        <div className="mb-3 flex gap-2">
          <textarea
            value={newObs}
            onChange={(e) => setNewObs(e.target.value)}
            rows={2}
            placeholder={t('academy.addObservationPlaceholder')}
            className="flex-1 resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          <Button onClick={handleAddObservation} isLoading={addingObs} disabled={!newObs.trim()}>
            {t('common.add')}
          </Button>
        </div>
        {observations.length === 0 ? (
          <p className="text-sm text-gray-400">{t('academy.noObservations')}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
            {observations.map((obs) => (
              <li key={obs.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-700 dark:text-gray-200">{obs.content}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {new Date(obs.created_at).toLocaleString(currentLocale(), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteObservation(obs.id)}
                  className="shrink-0 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-500/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <EnrollmentTable
        title={t('academy.upcomingSessions')}
        icon={<CalendarClock className="h-4 w-4" />}
        items={data.upcoming_sessions}
        emptyLabel={t('academy.noUpcomingSessions')}
      />

      <EnrollmentTable
        title={t('academy.recentEnrollments')}
        icon={<CalendarDays className="h-4 w-4" />}
        items={data.recent_enrollments}
        emptyLabel={t('academy.noEnrollments')}
      />
    </div>
  );
}
