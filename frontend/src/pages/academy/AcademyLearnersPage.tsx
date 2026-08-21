import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, CalendarPlus } from 'lucide-react';
import { academyApi, type Enrollment, type TrainingSession } from '@/api/academy.api';
import { clientsApi } from '@/api/clients.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Pagination } from '@/components/ui/Pagination';
import { currentLocale } from '@/i18n';
import type { Agency } from '@/types/agency';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

const STATUSES = ['enrolled', 'completed', 'cancelled'] as const;

interface EnrollmentFormState {
  session_id: string;
  learner_user_id: string;
  notes: string;
}

const emptyEnrollmentForm: EnrollmentFormState = {
  session_id: '',
  learner_user_id: '',
  notes: '',
};

interface LearnerFormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  password: string;
  password_confirmation: string;
}

const emptyLearnerForm: LearnerFormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  password_confirmation: '',
};

export default function AcademyLearnersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { countryId } = useParams<{ countryId?: string }>();
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | (typeof STATUSES)[number]>('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Modal inscription : sessions planifiées/en cours (cache local) et
  // apprenants recherchés côté serveur.
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<TrainingSession[] | null>(null);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentFormState>(emptyEnrollmentForm);
  const [isSubmittingEnrollment, setIsSubmittingEnrollment] = useState(false);
  const [enrollmentError, setEnrollmentError] = useState<string | null>(null);
  const [enrollmentFieldErrors, setEnrollmentFieldErrors] = useState<Record<string, string>>({});

  // Modal nouvel apprenant : création d'un user rôle « client ».
  const [learnerOpen, setLearnerOpen] = useState(false);
  const [learnerForm, setLearnerForm] = useState<LearnerFormState>(emptyLearnerForm);
  const [isSubmittingLearner, setIsSubmittingLearner] = useState(false);
  const [learnerError, setLearnerError] = useState<string | null>(null);
  const [learnerFieldErrors, setLearnerFieldErrors] = useState<Record<string, string>>({});

  const fetchEnrollments = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.enrollments({
        agency_id: agencyId,
        status: statusFilter || undefined,
        page,
        per_page: 15,
      });
      setEnrollments(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, statusFilter, page, t]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  // Sessions ouvertes (planifiées / en cours) chargées une fois par ouverture
  // du modal, puis filtrées localement (pas de recherche serveur sur ce endpoint).
  const fetchOpenSessions = useCallback(async (): Promise<TrainingSession[]> => {
    if (!agencyId) return [];
    if (openSessions) return openSessions;
    const response = await academyApi.sessions({ agency_id: agencyId, per_page: 100 });
    const list = response.data.filter((s) => s.status === 'planned' || s.status === 'ongoing');
    setOpenSessions(list);
    return list;
  }, [agencyId, openSessions]);

  const sessionOptions = useCallback(
    async (query: string) => {
      const list = await fetchOpenSessions();
      const q = query.trim().toLowerCase();
      const filtered = q
        ? list.filter((s) =>
            `${s.course?.name ?? ''} ${s.course?.code ?? ''}`.toLowerCase().includes(q),
          )
        : list;
      return filtered.map((session) => ({
        id: session.id,
        label: session.course?.name ?? t('nav.courses'),
        subtitle: new Date(session.start_at).toLocaleString(currentLocale(), {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
      }));
    },
    [fetchOpenSessions, t],
  );

  const learnerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await clientsApi.list({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((client) => ({
        id: client.id,
        label:
          [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email,
        subtitle: [client.client_number, client.email].filter(Boolean).join(' — '),
      }));
    },
    [agencyId],
  );

  function openEnrollmentModal() {
    setEnrollmentForm(emptyEnrollmentForm);
    setEnrollmentError(null);
    setEnrollmentFieldErrors({});
    setOpenSessions(null);
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
      await academyApi.createEnrollment({
        session_id: enrollmentForm.session_id,
        learner_user_id: enrollmentForm.learner_user_id,
        notes: enrollmentForm.notes || null,
      });
      showToast(t('academy.enrollmentCreated'), 'success');
      setEnrollmentOpen(false);
      setPage(1);
      fetchEnrollments();
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
        password: learnerForm.password,
        password_confirmation: learnerForm.password_confirmation,
      });
      showToast(t('academy.learnerCreated'), 'success');
      setLearnerOpen(false);
    } catch (error) {
      setLearnerError(extractErrorMessage(error, t('academy.saveFailed')));
      setLearnerFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmittingLearner(false);
    }
  }

  function statusBadge(status: Enrollment['status']) {
    if (status === 'completed') return <Badge variant="success">{t('academy.statusCompleted')}</Badge>;
    if (status === 'cancelled') return <Badge variant="error">{t('academy.statusCancelled')}</Badge>;
    return <Badge variant="brand">{t('academy.statusEnrolled')}</Badge>;
  }

  function openLearner(enrollment: Enrollment) {
    if (!enrollment.learner?.id) return;
    navigate(
      countryId
        ? `/countries/${countryId}/agencies/${agencyId}/academy/learners/${enrollment.learner.id}`
        : `/agencies/${agencyId}/academy/learners/${enrollment.learner.id}`,
    );
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
        <div className="flex max-w-xs gap-3">
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
        ) : enrollments.length === 0 ? (
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
                {enrollments.map((enrollment) => (
                  <tr
                    key={enrollment.id}
                    onClick={() => openLearner(enrollment)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {[enrollment.learner?.first_name, enrollment.learner?.last_name]
                          .filter(Boolean)
                          .join(' ') || enrollment.learner?.email || '—'}
                      </span>
                      {enrollment.learner?.client_number && (
                        <span className="ml-2 font-mono text-xs text-gray-400">
                          {enrollment.learner.client_number}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {enrollment.session?.course?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {enrollment.session?.start_at
                        ? new Date(enrollment.session.start_at).toLocaleDateString(currentLocale())
                        : '—'}
                    </td>
                    <td className="px-5 py-3">{statusBadge(enrollment.status)}</td>
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

          <Autocomplete
            label={`${t('nav.sessions')} *`}
            placeholder={t('academy.searchSessionPlaceholder')}
            value={enrollmentForm.session_id}
            onChange={(sessionId) => setEnrollmentForm((prev) => ({ ...prev, session_id: sessionId }))}
            fetchOptions={sessionOptions}
            error={enrollmentFieldErrors.session_id}
          />

          <Autocomplete
            label={`${t('academy.learner')} *`}
            placeholder={t('academy.searchLearnerPlaceholder')}
            value={enrollmentForm.learner_user_id}
            onChange={(learnerId) => setEnrollmentForm((prev) => ({ ...prev, learner_user_id: learnerId }))}
            fetchOptions={learnerOptions}
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
