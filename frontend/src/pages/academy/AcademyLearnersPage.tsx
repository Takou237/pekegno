import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, CalendarPlus } from 'lucide-react';
import { academyApi, type Course, type Learner, type TrainingSession } from '@/api/academy.api';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { EnrollmentLearnerField, emptyNewLearnerForm, type LearnerMode, type NewLearnerFormState } from '@/components/academy/EnrollmentLearnerField';
import { Pagination } from '@/components/ui/Pagination';
import { currentLocale } from '@/i18n';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string; type?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

const STATUSES = ['enrolled', 'completed', 'cancelled'] as const;

interface EnrollmentFormState {
  course_id: string;
  learner_user_id: string;
  training_session_id: string;
  amount_paid: string;
  notes: string;
}

const emptyEnrollmentForm: EnrollmentFormState = {
  course_id: '',
  learner_user_id: '',
  training_session_id: '',
  amount_paid: '',
  notes: '',
};

interface LearnerFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  password: string;
  password_confirmation: string;
}

const emptyLearnerForm: LearnerFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  address: '',
  password: '',
  password_confirmation: '',
};

export default function AcademyLearnersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { departmentId } = useParams<{ departmentId?: string }>();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | (typeof STATUSES)[number]>('');
  const [searchFilter, setSearchFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal inscription : formations recherchées côté serveur et
  // apprenants recherchés côté serveur.
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentFormState>(emptyEnrollmentForm);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [enrollmentFieldErrors, setEnrollmentFieldErrors] = useState<Record<string, string>>({});
  const [learnerMode, setLearnerMode] = useState<LearnerMode>('existing');
  const [newLearner, setNewLearner] = useState<NewLearnerFormState>(emptyNewLearnerForm);
  const [enrollmentCourses, setEnrollmentCourses] = useState<Course[]>([]);
  const [enrollmentSessions, setEnrollmentSessions] = useState<TrainingSession[]>([]);

  // Modal nouvel apprenant : création d'un user rôle « client ».
  const [learnerOpen, setLearnerOpen] = useState(false);
  const [learnerForm, setLearnerForm] = useState<LearnerFormState>(emptyLearnerForm);
  const [isSubmittingLearner, setIsSubmittingLearner] = useState(false);
  const [learnerError, setLearnerError] = useState<string | null>(null);
  const [learnerFieldErrors, setLearnerFieldErrors] = useState<Record<string, string>>({});

  const fetchLearners = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.learners({
        agency_id: agencyId,
        status: statusFilter || undefined,
        search: searchFilter || undefined,
        page,
        per_page: 15,
      });
      setLearners(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, statusFilter, searchFilter, page, t]);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  useEffect(() => {
    if (!enrollmentOpen || !agencyId) return;
    let active = true;
    academyApi
      .courses({ agency_id: agencyId, per_page: 100 })
      .then((res) => {
        if (active) setEnrollmentCourses(res.data);
      })
      .catch(() => {
        if (active) setEnrollmentCourses([]);
      });
    return () => {
      active = false;
    };
  }, [enrollmentOpen, agencyId]);

  useEffect(() => {
    if (!enrollmentForm.course_id || !agencyId) {
      setEnrollmentSessions([]);
      return;
    }
    setEnrollmentSessions([]);
    let active = true;
    academyApi
      .sessions({ agency_id: agencyId, course_id: enrollmentForm.course_id, per_page: 100 })
      .then((res) => {
        if (active) {
          setEnrollmentSessions(
            res.data.filter(
              (s) =>
                s.status !== 'cancelled' &&
                s.status !== 'completed' &&
                (s.end_at === null || new Date(s.end_at) >= new Date()),
            ),
          );
        }
      })
      .catch(() => {
        if (active) setEnrollmentSessions([]);
      });
    return () => {
      active = false;
    };
  }, [enrollmentForm.course_id, agencyId]);

  const selectedEnrollmentCourse =
    (courseId: string) => enrollmentCourses.find((c) => c.id === courseId) ?? null;

  const learnerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const q = query.trim();
      const response = await academyApi.learners({
        agency_id: agencyId,
        search: q || undefined,
        per_page: q ? 50 : 100,
      });
      return response.data.map((learner) => ({
        id: learner.id,
        label:
          [learner.learner?.first_name, learner.learner?.last_name].filter(Boolean).join(' ') ||
          learner.learner?.email ||
          '',
        subtitle: [learner.learner?.client_number, learner.learner?.email]
          .filter(Boolean)
          .join(' — '),
      }));
    },
    [agencyId],
  );

  function openEnrollmentModal() {
    setEnrollmentForm(emptyEnrollmentForm);
    setLearnerMode('existing');
    setNewLearner(emptyNewLearnerForm);
    setEnrollmentSessions([]);
    setEnrollmentError(null);
    setEnrollmentFieldErrors({});
    setEnrollmentOpen(true);
  }

  function openLearnerModal() {
    setLearnerForm(emptyLearnerForm);
    setLearnerError(null);
    setLearnerFieldErrors({});
    setLearnerOpen(true);
  }

  async function handleEnrollmentSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setEnrollmentError(null);
    setEnrollmentFieldErrors({});
    setIsSubmittingEnrollment(true);
    try {
      let learnerUserId = enrollmentForm.learner_user_id;
      if (learnerMode === 'new') {
        if (!newLearner.first_name || !newLearner.last_name || !newLearner.email) {
          setEnrollmentError(t('academy.newLearnerRequired'));
          setIsSubmittingEnrollment(false);
          return;
        }
        const created = await clientsApi.create({
          first_name: newLearner.first_name,
          last_name: newLearner.last_name,
          email: newLearner.email,
          phone: newLearner.phone || null,
          registered_agency_id: agencyId,
        });
        learnerUserId = created.id;
      }
      await academyApi.createFormationEnrollment({
        course_id: enrollmentForm.course_id,
        learner_user_id: learnerUserId,
        training_session_id: enrollmentForm.training_session_id || undefined,
        ...(enrollmentForm.amount_paid ? { amount_paid: Number(enrollmentForm.amount_paid) } : {}),
        notes: enrollmentForm.notes || undefined,
      });
      showToast(t('academy.enrollmentCreated'), 'success');
      setEnrollmentOpen(false);
      setPage(1);
      fetchLearners();
    } catch (error) {
      setEnrollmentError(extractErrorMessage(error, t('academy.saveFailed')));
      setEnrollmentFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmittingEnrollment(false);
    }
  }

  async function handleLearnerSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setLearnerError(null);
    setLearnerFieldErrors({});
    setIsSubmittingLearner(true);
    try {
      await clientsApi.create({
        first_name: learnerForm.first_name,
        last_name: learnerForm.last_name,
        email: learnerForm.email,
        phone: learnerForm.phone || null,
        city: learnerForm.city || null,
        country: learnerForm.country || null,
        address: learnerForm.address || null,
        password: learnerForm.password,
        password_confirmation: learnerForm.password_confirmation,
        registered_agency_id: agencyId,
      });
      showToast(t('academy.learnerCreated'), 'success');
      setLearnerOpen(false);
      setPage(1);
      fetchLearners();
    } catch (error) {
      setLearnerError(extractErrorMessage(error, t('academy.saveFailed')));
      setLearnerFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmittingLearner(false);
    }
  }

  function statusBadge(status: Learner['status']) {
    if (status === 'completed') return <Badge variant="success">{t('academy.statusCompleted')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
    if (status === 'enrolled') return <Badge variant="brand">{t('academy.statusEnrolled')}</Badge>;
    return <Badge variant="neutral">{t('academy.noEnrollments')}</Badge>;
  }

  function openLearner(learner: Learner) {
    if (!learner.learner?.id || !departmentId) return;
    navigate(`/departments/${departmentId}/learners/${learner.learner.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.learners')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.learnersSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={openLearnerModal}>
            <UserPlus className="h-4 w-4" />
            {t('academy.newLearner')}
          </Button>
          <Button onClick={openEnrollmentModal}>
            <CalendarPlus className="h-4 w-4" />
            {t('academy.newEnrollment')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={searchFilter}
            onChange={(e) => {
              setPage(1);
              setSearchFilter(e.target.value);
            }}
            placeholder={t('academy.searchLearners')}
            className="w-56 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder-gray-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => {
              setPage(1);
              setStatusFilter(e.target.value as typeof statusFilter);
            }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          >
            <option value="">{t('academy.allStatuses')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === 'enrolled'
                  ? t('academy.statusEnrolled')
                  : s === 'completed'
                    ? t('academy.statusCompleted')
                    : t('academy.statusCancelled')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : learners.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noEnrollments')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('academy.learner')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.courses')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.sessionDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {learners.map((learner) => (
                  <tr
                    key={learner.id}
                    onClick={() => openLearner(learner)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {[learner.learner?.first_name, learner.learner?.last_name]
                          .filter(Boolean)
                          .join(' ') || learner.learner?.email || '—'}
                      </span>
                      {learner.learner?.client_number && (
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {learner.learner.client_number}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {learner.primary?.course_name ?? learner.session?.course?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {learner.primary?.date
                        ? new Date(learner.primary.date).toLocaleDateString(currentLocale())
                        : learner.session?.start_at
                          ? new Date(learner.session.start_at).toLocaleDateString(currentLocale())
                          : '—'}
                    </td>
                    <td className="px-5 py-3">{statusBadge(learner.primary?.status ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={15}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={enrollmentOpen}
        onClose={() => setEnrollmentOpen(false)}
        title={t('academy.newEnrollment')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleEnrollmentSubmit} className="flex flex-col gap-4">
          {enrollmentError && <Alert variant="error">{enrollmentError}</Alert>}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {`${t('nav.courses')} *`}
            </label>
            <select
              value={enrollmentForm.course_id || ''}
              onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, course_id: e.target.value, training_session_id: '' }))}
              className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${
                enrollmentFieldErrors.course_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">{t('academy.selectCourse')}</option>
              {enrollmentCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {`${course.name} — ${course.effective_price != null ? `${Number(course.effective_price).toLocaleString()} FCFA` : course.price != null ? `${Number(course.price).toLocaleString()} FCFA` : course.code}`}
                </option>
              ))}
            </select>
            {enrollmentFieldErrors.course_id && (
              <p className="mt-1 text-xs text-red-500">{enrollmentFieldErrors.course_id}</p>
            )}
          </div>

          {(selectedEnrollmentCourse(enrollmentForm.course_id)?.effective_price != null || selectedEnrollmentCourse(enrollmentForm.course_id)?.price != null) && (
            <div className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              {t('academy.priceToPay', { amount: Number(selectedEnrollmentCourse(enrollmentForm.course_id)?.effective_price ?? selectedEnrollmentCourse(enrollmentForm.course_id)?.price).toLocaleString() })}
            </div>
          )}

          <Input
            label={`${t('academy.amountPaid')} (FCFA)`}
            type="number"
            min={0}
            placeholder="0"
            value={enrollmentForm.amount_paid}
            onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, amount_paid: e.target.value }))}
            error={enrollmentFieldErrors.amount_paid}
            hint={t('academy.amountPaidHint')}
          />

          {enrollmentForm.course_id && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {`${t('academy.session')} *`}
              </label>
              <select
                required
                value={enrollmentForm.training_session_id}
                onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, training_session_id: e.target.value }))}
                className={`w-full rounded-lg border px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${
                  enrollmentFieldErrors.training_session_id ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">{t('academy.selectSession')}</option>
                {enrollmentSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {`${t('academy.session')} — ${new Date(session.start_at).toLocaleDateString(currentLocale())}${session.max_capacity != null ? ` (${session.enrollments_count ?? 0}/${session.max_capacity})` : ''}`}
                  </option>
                ))}
              </select>
              {enrollmentSessions.length === 0 && (
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {t('academy.noSessionsForCourse')}
                </p>
              )}
              {enrollmentFieldErrors.training_session_id && (
                <p className="mt-1 text-xs text-red-500">{enrollmentFieldErrors.training_session_id}</p>
              )}
            </div>
          )}

          <EnrollmentLearnerField
            mode={learnerMode}
            onModeChange={setLearnerMode}
            learnerUserId={enrollmentForm.learner_user_id}
            onLearnerUserIdChange={(learnerId) => setEnrollmentForm((prev) => ({ ...prev, learner_user_id: learnerId }))}
            fetchOptions={learnerOptions}
            newLearner={newLearner}
            onNewLearnerChange={setNewLearner}
            error={enrollmentFieldErrors.learner_user_id}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.notes')}
            </label>
            <textarea
              value={enrollmentForm.notes}
              onChange={(e) => setEnrollmentForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setEnrollmentOpen(false)} disabled={isSubmittingEnrollment} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmittingEnrollment} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={learnerOpen}
        onClose={() => setLearnerOpen(false)}
        title={t('academy.newLearner')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleLearnerSubmit} className="flex flex-col gap-4">
          {learnerError && <Alert variant="error">{learnerError}</Alert>}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.firstName')}
              required
              value={learnerForm.first_name}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, first_name: e.target.value }))}
              error={learnerFieldErrors.first_name}
            />
            <Input
              label={t('common.lastName')}
              required
              value={learnerForm.last_name}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, last_name: e.target.value }))}
              error={learnerFieldErrors.last_name}
            />
          </div>

          <Input
            label={t('common.email')}
            type="email"
            required
            value={learnerForm.email}
            onChange={(e) => setLearnerForm((prev) => ({ ...prev, email: e.target.value }))}
            error={learnerFieldErrors.email}
          />

          <Input
            label={t('common.phone')}
            value={learnerForm.phone}
            onChange={(e) => setLearnerForm((prev) => ({ ...prev, phone: e.target.value }))}
            error={learnerFieldErrors.phone}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('clients.city')}
              value={learnerForm.city}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, city: e.target.value }))}
              error={learnerFieldErrors.city}
            />
            <Input
              label={t('clients.country')}
              value={learnerForm.country}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, country: e.target.value }))}
              error={learnerFieldErrors.country}
            />
          </div>

          <Input
            label={t('clients.address')}
            value={learnerForm.address}
            onChange={(e) => setLearnerForm((prev) => ({ ...prev, address: e.target.value }))}
            error={learnerFieldErrors.address}
            placeholder={t('clients.addressPlaceholder')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.password')}
              type="password"
              required
              minLength={8}
              value={learnerForm.password}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, password: e.target.value }))}
              error={learnerFieldErrors.password}
            />
            <Input
              label={t('common.confirmPassword')}
              type="password"
              required
              minLength={8}
              value={learnerForm.password_confirmation}
              onChange={(e) => setLearnerForm((prev) => ({ ...prev, password_confirmation: e.target.value }))}
              error={learnerFieldErrors.password_confirmation}
            />
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">{t('academy.learnerHint')}</p>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setLearnerOpen(false)} disabled={isSubmittingLearner} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmittingLearner} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
