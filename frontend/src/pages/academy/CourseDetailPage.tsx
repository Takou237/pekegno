import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  Layers,
  Plus,
  Users,
  StickyNote,
  UserPlus,
  ClipboardList,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  academyApi,
  type Course,
  type Learner,
  type SessionStatus,
  type TrainingSession,
} from '@/api/academy.api';
import type {
  CourseModule as CourseModuleType,
  FormationEnrollment,
  FormationEnrollmentPayload,
  LearnerObservation,
} from '@/types/formation';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatCurrency } from '@/utils/number';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

type Tab = 'sessions' | 'learners' | 'modules' | 'observations';

function statusLabel(status: SessionStatus, t: ReturnType<typeof useTranslation>['t']): string {
  switch (status) {
    case 'ongoing':
      return t('academy.statusOngoing');
    case 'completed':
      return t('academy.statusCompletedSession');
    case 'cancelled':
      return t('academy.statusCancelled');
    default:
      return t('academy.statusPlanned');
  }
}

function statusBadge(status: SessionStatus, t: ReturnType<typeof useTranslation>['t']) {
  switch (status) {
    case 'ongoing':
      return <Badge variant="warning">{statusLabel(status, t)}</Badge>;
    case 'completed':
      return <Badge variant="success">{statusLabel(status, t)}</Badge>;
    case 'cancelled':
      return <Badge variant="error">{statusLabel(status, t)}</Badge>;
    default:
      return <Badge variant="brand">{statusLabel(status, t)}</Badge>;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(currentLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface SessionFormState {
  module_id: string;
  trainer_id: string;
  start_at: string;
  end_at: string;
  max_capacity: string;
  status: SessionStatus;
}

interface EnrollmentFormState {
  learner_user_id: string;
  notes: string;
}

export default function CourseDetailPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { courseId, departmentId } = useParams<{ courseId: string; departmentId: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [course, setCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [modules, setModules] = useState<CourseModuleType[]>([]);
  const [learners, setLearners] = useState<FormationEnrollment[]>([]);
  const [observations, setObservations] = useState<LearnerObservation[]>([]);
  const [tab, setTab] = useState<Tab>('sessions');

  const [sessionFormOpen, setSessionFormOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState<SessionFormState>({
    module_id: '',
    trainer_id: '',
    start_at: '',
    end_at: '',
    max_capacity: '',
    status: 'planned',
  });
  const [sessionSubmitting, setSessionSubmitting] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionFieldErrors, setSessionFieldErrors] = useState<Record<string, string>>({});

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState<EnrollmentFormState>({ learner_user_id: '', notes: '' });
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollFieldErrors, setEnrollFieldErrors] = useState<Record<string, string>>({});

  const [deleteSession, setDeleteSession] = useState<TrainingSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!courseId || !agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [courseData, sessionsData, modulesData, learnersData, observationsData] = await Promise.all([
        academyApi.getCourse(courseId),
        academyApi.sessions({ course_id: courseId, agency_id: agencyId, per_page: 100 }),
        academyApi.modules(courseId),
        academyApi.courseLearners(courseId),
        academyApi.learnerObservations({ course_id: courseId, per_page: 50 }),
      ]);
      setCourse(courseData);
      setSessions(sessionsData.data);
      setModules(modulesData);
      setLearners(learnersData);
      setObservations(observationsData.data ?? []);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [courseId, agencyId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const learnerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const q = query.trim();
      const response = await academyApi.learners({
        agency_id: agencyId,
        search: q || undefined,
        per_page: q ? 50 : 100,
      });
      return response.data.map((learner: Learner) => {
        const fullName =
          [learner.learner?.first_name, learner.learner?.last_name].filter(Boolean).join(' ') ||
          learner.learner?.email ||
          '';
        return {
          id: learner.id,
          label: fullName,
          subtitle: [learner.learner?.client_number, learner.learner?.email].filter(Boolean).join(' — '),
        };
      });
    },
    [agencyId],
  );

  const moduleOptions = useCallback(
    async (query: string) => {
      const q = query.trim().toLowerCase();
      return modules
        .filter((m) => !q || m.name.toLowerCase().includes(q))
        .map((m) => ({ id: m.id, label: m.name, subtitle: `#${m.order_index}` }));
    },
    [modules],
  );

  const trainerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await academyApi.trainers({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((trainer) => ({
        id: trainer.id,
        label: [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email || '—',
        subtitle: trainer.email ?? undefined,
      }));
    },
    [agencyId],
  );

  function openCreateSession() {
    setSessionForm({
      module_id: '',
      trainer_id: '',
      start_at: '',
      end_at: '',
      max_capacity: '',
      status: 'planned',
    });
    setSessionError(null);
    setSessionFieldErrors({});
    setSessionFormOpen(true);
  }

  async function handleCreateSession(event: FormEvent) {
    event.preventDefault();
    if (!courseId || !agencyId) return;
    setSessionError(null);
    setSessionFieldErrors({});
    setSessionSubmitting(true);
    try {
      const saved = await academyApi.createSession({
        course_id: courseId,
        agency_id: agencyId,
        module_id: sessionForm.module_id || null,
        trainer_id: sessionForm.trainer_id || null,
        start_at: sessionForm.start_at,
        end_at: sessionForm.end_at || null,
        max_capacity: sessionForm.max_capacity ? Number(sessionForm.max_capacity) : null,
        status: sessionForm.status,
      });
      setSessions((prev) => [saved, ...prev]);
      showToast(t('academy.saved'), 'success');
      setSessionFormOpen(false);
    } catch (error) {
      setSessionError(extractErrorMessage(error, t('academy.saveFailed')));
      setSessionFieldErrors(extractFieldErrors(error));
    } finally {
      setSessionSubmitting(false);
    }
  }

  function openEnroll() {
    setEnrollForm({ learner_user_id: '', notes: '' });
    setEnrollError(null);
    setEnrollFieldErrors({});
    setEnrollOpen(true);
  }

  async function handleEnroll(event: FormEvent) {
    event.preventDefault();
    if (!courseId || !agencyId) return;
    setEnrollError(null);
    setEnrollFieldErrors({});
    setEnrollSubmitting(true);
    const payload: FormationEnrollmentPayload = {
      course_id: courseId,
      learner_user_id: enrollForm.learner_user_id,
      notes: enrollForm.notes || undefined,
    };
    try {
      const saved = await academyApi.createFormationEnrollment(payload);
      setLearners((prev) => [saved, ...prev]);
      showToast(t('academy.enrollmentCreated'), 'success');
      setEnrollOpen(false);
    } catch (error) {
      setEnrollError(extractErrorMessage(error, t('academy.saveFailed')));
      setEnrollFieldErrors(extractFieldErrors(error));
    } finally {
      setEnrollSubmitting(false);
    }
  }

  async function handleDeleteSession() {
    if (!deleteSession) return;
    setIsDeleting(true);
    try {
      await academyApi.removeSession(deleteSession.id);
      setSessions((prev) => prev.filter((s) => s.id !== deleteSession.id));
      showToast(t('academy.sessionDeleted'), 'success');
      setDeleteSession(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed').length;
    const ongoing = sessions.filter((s) => s.status === 'ongoing').length;
    const totalParticipants = learners.filter((l) => l.status !== 'cancelled').length;
    return {
      sessions_count: sessions.length,
      modules_count: modules.length,
      learners_count: totalParticipants,
      completed,
      ongoing,
    };
  }, [sessions, modules, learners]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <SkeletonTable rows={5} />
      </div>
    );
  }

  if (loadError || !course) {
    return (
      <div className="flex flex-col gap-4">
        <Link to={`/departments/${departmentId}/courses`} className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
          <ArrowLeft className="h-4 w-4" />
          {t('nav.courses')}
        </Link>
        <Alert variant="error">{loadError ?? t('academy.loadFailed')}</Alert>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: typeof CalendarDays }[] = [
    { key: 'sessions', label: t('nav.sessions'), icon: CalendarDays },
    { key: 'learners', label: t('nav.learners'), icon: Users },
    { key: 'modules', label: t('academy.modules'), icon: Layers },
    { key: 'observations', label: t('academy.observations'), icon: StickyNote },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to={`/departments/${departmentId}/courses`}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
            title={t('nav.courses')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{course.name}</h1>
            <p className="font-mono text-xs text-gray-400">{course.code}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={openEnroll}>
            <UserPlus className="h-4 w-4" />
            {t('academy.newEnrollment')}
          </Button>
          <Button onClick={openCreateSession}>
            <Plus className="h-4 w-4" />
            {t('academy.newSession')}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400">{t('nav.sessions')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.sessions_count}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400">{t('academy.modules')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.modules_count}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400">{t('nav.learners')}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{stats.learners_count}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400">{t('academy.statusOngoing')}</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.ongoing}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-xs text-gray-400">{t('academy.statusCompletedSession')}</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{stats.completed}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-100 dark:border-gray-800">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              {key === 'sessions' ? stats.sessions_count : key === 'learners' ? stats.learners_count : key === 'modules' ? stats.modules_count : observations.length}
            </span>
          </button>
        ))}
      </div>

      {tab === 'sessions' && (
        <div className="flex flex-col gap-3">
          {sessions.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noSessions')}</p>
          ) : (
            sessions.map((session) => {
              const isExpanded = expandedSession === session.id;
              return (
                <div
                  key={session.id}
                  className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {session.module?.name ?? t('academy.session')}
                        </span>
                        {statusBadge(session.status, t)}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(session.start_at)} → {formatDate(session.end_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {session.enrollments_count ?? 0}
                        </span>
                        {session.effective_price != null && (
                          <span>{formatCurrency(session.effective_price)}</span>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('academy.enrolledLearners')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={openEnroll}>
                            <UserPlus className="h-4 w-4" />
                            {t('academy.newEnrollment')}
                          </Button>
                          <Link to={`/departments/${departmentId}/sessions/${session.id}/attendances`}>
                            <Button variant="outline" size="sm">
                              <ClipboardList className="h-4 w-4" />
                              {t('nav.presences')}
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {learners.length === 0 ? (
                        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{t('academy.noEnrollments')}</p>
                      ) : (
                        <ul className="mt-3 divide-y divide-gray-50 dark:divide-gray-800">
                          {learners.map((enrollment) => (
                            <li key={enrollment.id} className="flex items-center justify-between py-2 text-sm">
                              <span className="text-gray-700 dark:text-gray-300">
                                {[enrollment.learner?.first_name, enrollment.learner?.last_name].filter(Boolean).join(' ') ||
                                  enrollment.learner?.email ||
                                  '—'}
                              </span>
                              <Badge variant={enrollment.status === 'cancelled' ? 'error' : enrollment.status === 'completed' ? 'success' : 'brand'}>
                                {enrollment.status === 'cancelled'
                                  ? t('academy.statusCancelled')
                                  : enrollment.status === 'completed'
                                    ? t('academy.statusCompleted')
                                    : t('academy.statusEnrolled')}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'learners' && (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {learners.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noEnrollments')}</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('academy.learner')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.statusEnrolled')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {learners.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">
                      {[enrollment.learner?.first_name, enrollment.learner?.last_name].filter(Boolean).join(' ') ||
                        enrollment.learner?.email ||
                        '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={enrollment.status === 'cancelled' ? 'error' : enrollment.status === 'completed' ? 'success' : 'brand'}>
                        {enrollment.status === 'cancelled'
                          ? t('academy.statusCancelled')
                          : enrollment.status === 'completed'
                            ? t('academy.statusCompleted')
                            : t('academy.statusEnrolled')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'modules' && (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          {modules.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noModules')}</p>
          ) : (
            <ul className="divide-y divide-gray-50 dark:divide-gray-800">
              {modules.map((module) => (
                <li key={module.id} className="flex items-center justify-between px-5 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {module.order_index}
                    </span>
                    <div>
                      <p className="text-gray-800 dark:text-gray-100">{module.name}</p>
                      {module.trainer && (
                        <p className="text-xs text-gray-400">
                          {[module.trainer.first_name, module.trainer.last_name].filter(Boolean).join(' ')}
                        </p>
                      )}
                    </div>
                  </div>
                  {module.duration_hours != null && (
                    <span className="text-xs text-gray-400">
                      {module.duration_hours} {t('academy.hours')}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'observations' && (
        <div className="flex flex-col gap-3">
          {observations.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noObservations')}</p>
          ) : (
            observations.map((observation) => (
              <div
                key={observation.id}
                className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">{observation.content}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {observation.session ? formatDate(observation.session.start_at) : ''}
                  {observation.created_at ? ` · ${new Date(observation.created_at).toLocaleString(currentLocale())}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* New session modal */}
      <Modal
        isOpen={sessionFormOpen}
        onClose={() => setSessionFormOpen(false)}
        title={t('academy.newSession')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSession} className="flex flex-col gap-4">
          {sessionError && <Alert variant="error">{sessionError}</Alert>}
          <Autocomplete
            label={t('academy.module')}
            placeholder={t('academy.searchSessionPlaceholder')}
            value={sessionForm.module_id}
            onChange={(moduleId) => setSessionForm((prev) => ({ ...prev, module_id: moduleId }))}
            fetchOptions={moduleOptions}
            error={sessionFieldErrors.module_id}
          />
          <Autocomplete
            label={t('academy.trainer')}
            placeholder={t('academy.searchTrainerPlaceholder')}
            value={sessionForm.trainer_id}
            onChange={(trainerId) => setSessionForm((prev) => ({ ...prev, trainer_id: trainerId }))}
            fetchOptions={trainerOptions}
            error={sessionFieldErrors.trainer_id}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`${t('academy.startAt')} *`}
              type="datetime-local"
              required
              value={sessionForm.start_at}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, start_at: e.target.value }))}
              error={sessionFieldErrors.start_at}
            />
            <Input
              label={t('academy.endAt')}
              type="datetime-local"
              value={sessionForm.end_at}
              onChange={(e) => setSessionForm((prev) => ({ ...prev, end_at: e.target.value }))}
              error={sessionFieldErrors.end_at}
            />
          </div>
          <Input
            label={t('academy.maxCapacity')}
            type="number"
            min={1}
            value={sessionForm.max_capacity}
            onChange={(e) => setSessionForm((prev) => ({ ...prev, max_capacity: e.target.value }))}
            error={sessionFieldErrors.max_capacity}
          />
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setSessionFormOpen(false)} disabled={sessionSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={sessionSubmitting} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Enroll learner modal */}
      <Modal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        title={t('academy.newEnrollment')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEnroll} className="flex flex-col gap-4">
          {enrollError && <Alert variant="error">{enrollError}</Alert>}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {`${t('nav.courses')} *`}
            </label>
            <input
              readOnly
              value={course.name}
              className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
          </div>
          {course.price != null && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              {t('academy.priceToPay', { amount: Number(course.price).toLocaleString() })}
            </div>
          )}
          <Autocomplete
            label={`${t('academy.learner')} *`}
            placeholder={t('academy.searchLearnerPlaceholder')}
            value={enrollForm.learner_user_id}
            onChange={(learnerId) => setEnrollForm((prev) => ({ ...prev, learner_user_id: learnerId }))}
            fetchOptions={learnerOptions}
            error={enrollFieldErrors.learner_user_id}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.notes')}
            </label>
            <textarea
              value={enrollForm.notes}
              onChange={(e) => setEnrollForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)} disabled={enrollSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={enrollSubmitting} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteSession)}
        title={t('academy.deleteSessionTitle')}
        message={t('academy.deleteSessionConfirm', { label: deleteSession?.module?.name ?? '' })}
        confirmLabel={t('common.delete')}
        isLoading={isDeleting}
        onConfirm={handleDeleteSession}
        onCancel={() => setDeleteSession(null)}
      />
    </div>
  );
}
