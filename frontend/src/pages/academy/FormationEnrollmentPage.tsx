import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course } from '@/api/academy.api';
import { clientsApi } from '@/api/clients.api';
import { commercialsApi } from '@/api/commercials.api';
import { employeesApi } from '@/api/employees.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Pagination } from '@/components/ui/Pagination';
import { currentLocale } from '@/i18n';
import type {
  FormationEnrollment,
  FormationEnrollmentPayload,
} from '@/types/formation';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

type EnrollmentStatus = 'enrolled' | 'completed' | 'cancelled';

const STATUSES: EnrollmentStatus[] = ['enrolled', 'completed', 'cancelled'];

function statusLabel(status: EnrollmentStatus, t: ReturnType<typeof useTranslation>['t']): string {
  switch (status) {
    case 'enrolled': return t('academy.statusEnrolled');
    case 'completed': return t('academy.statusCompleted');
    case 'cancelled': return t('academy.statusCancelled');
    default: return status;
  }
}

const STATUS_BADGE_CLASSES: Record<EnrollmentStatus, string> = {
  enrolled: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

interface FormState {
  course_id: string;
  learner_user_id: string;
  seller_user_id: string;
  notes: string;
}

const emptyForm: FormState = {
  course_id: '',
  learner_user_id: '',
  seller_user_id: '',
  notes: '',
};

export default function FormationEnrollmentPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [enrollments, setEnrollments] = useState<FormationEnrollment[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | EnrollmentStatus>('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FormationEnrollment | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [statusModal, setStatusModal] = useState<FormationEnrollment | null>(null);
  const [newStatus, setNewStatus] = useState<EnrollmentStatus>('enrolled');

  const fetchEnrollments = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.formationEnrollments({
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

  const courseOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await academyApi.courses({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((course: Course) => ({
        id: course.id,
        label: course.name,
        subtitle: course.code,
      }));
    },
    [agencyId],
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
        label: [client.first_name, client.last_name].filter(Boolean).join(' ') || client.name || client.email,
        subtitle: client.email,
      }));
    },
    [agencyId],
  );

  const sellerOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const [commercials, employees] = await Promise.all([
        commercialsApi.list({ agency_id: agencyId, per_page: 100 }),
        employeesApi.list({ agency_id: agencyId, per_page: 100 }),
      ]);
      const all = [
        ...commercials.data.map((c) => ({ user_id: c.user_id, name: `${c.first_name} ${c.last_name}`.trim(), email: c.email ?? '', kind: 'commercial' as const })),
        ...employees.data.map((e) => ({ user_id: e.user_id, name: `${e.first_name} ${e.last_name}`.trim(), email: e.email ?? '', kind: 'employe' as const })),
      ].filter((o) => o.user_id);
      const q = query.trim().toLowerCase();
      const filtered = q
        ? all.filter((o) => o.name.toLowerCase().includes(q) || o.email.toLowerCase().includes(q))
        : all;
      return filtered.map((o) => ({
        id: o.user_id as string,
        label: o.name || o.email || (o.user_id as string),
        subtitle: o.email || (o.kind === 'employe' ? t('academy.employee') : t('academy.commercial')),
      }));
    },
    [agencyId, t],
  );

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(enrollment: FormationEnrollment) {
    setEditing(enrollment);
    setForm({
      course_id: enrollment.course_id,
      learner_user_id: enrollment.learner_user_id,
      seller_user_id: enrollment.seller_user_id ?? '',
      notes: enrollment.notes ?? '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!agencyId) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: FormationEnrollmentPayload = {
      course_id: form.course_id,
      learner_user_id: form.learner_user_id,
      seller_user_id: form.seller_user_id || undefined,
      notes: form.notes || undefined,
    };

    try {
      if (editing) {
        const saved = await academyApi.updateFormationEnrollment(editing.id, payload);
        setEnrollments((prev) => prev.map((e) => (e.id === saved.id ? saved : e)));
      } else {
        const saved = await academyApi.createFormationEnrollment(payload);
        setEnrollments((prev) => [saved, ...prev]);
      }
      showToast(t('academy.saved'), 'success');
      setFormOpen(false);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(enrollment: FormationEnrollment) {
    if (!window.confirm(t('academy.deleteEnrollmentConfirm'))) return;
    try {
      await academyApi.removeFormationEnrollment(enrollment.id);
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollment.id));
      showToast(t('academy.enrollmentDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  function openStatusModal(enrollment: FormationEnrollment) {
    setEditing(enrollment);
    setNewStatus(enrollment.status as EnrollmentStatus);
    setStatusModal(enrollment);
  }

  async function handleStatusUpdate() {
    if (!statusModal) return;
    try {
      const saved = await academyApi.updateFormationEnrollment(statusModal.id, {
        course_id: statusModal.course_id,
        learner_user_id: statusModal.learner_user_id,
        status: newStatus,
      });
      setEnrollments((prev) => prev.map((e) => (e.id === statusModal.id ? saved : e)));
      showToast(t('academy.statusUpdated'), 'success');
      setStatusModal(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.saveFailed')), 'error');
    }
  }

  function statusBadge(status: string, t: ReturnType<typeof useTranslation>['t']) {
    const key = status as EnrollmentStatus;
    const label = statusLabel(key, t);
    const colorClass = STATUS_BADGE_CLASSES[key] ?? 'bg-gray-100 text-gray-600';
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      >
        {label}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('academy.formationEnrollments')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.formationEnrollmentsSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newEnrollment')}
        </Button>
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
                {statusLabel(s, t)}
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
                  <th className="px-5 py-3 font-medium">{t('academy.price')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.sessionsCount')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.enrolledAt')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.seller')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {enrollment.learner
                          ? [enrollment.learner.first_name, enrollment.learner.last_name].filter(Boolean).join(' ') || enrollment.learner.email
                          : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-gray-600 dark:text-gray-300">{enrollment.course?.name ?? '—'}</span>
                      {enrollment.course?.code && (
                        <span className="ml-2 font-mono text-xs text-gray-400">{enrollment.course.code}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {enrollment.course?.price != null
                        ? `${Number(enrollment.course.price).toLocaleString()} FCFA`
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {enrollment.course?.sessions_count != null ? enrollment.course.sessions_count : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => openStatusModal(enrollment)}
                        className="cursor-pointer hover:opacity-80"
                        title={t('academy.changeStatus')}
                      >
                        {statusBadge(enrollment.status, t)}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(enrollment.enrolled_at).toLocaleDateString(currentLocale(), {
                        dateStyle: 'medium',
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {enrollment.seller
                        ? [enrollment.seller.first_name, enrollment.seller.last_name].filter(Boolean).join(' ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(enrollment)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(enrollment)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                          title={t('common.delete')}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
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
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('academy.editEnrollment') : t('academy.newEnrollment')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          {!editing && (
            <Autocomplete
              label={`${t('nav.courses')} *`}
              placeholder={t('academy.searchCoursePlaceholder')}
              value={form.course_id}
              onChange={(courseId) => setForm((prev) => ({ ...prev, course_id: courseId }))}
              fetchOptions={courseOptions}
              error={fieldErrors.course_id}
            />
          )}

          <Autocomplete
            label={`${t('academy.learner')} *`}
            placeholder={t('academy.searchLearnerPlaceholder')}
            value={form.learner_user_id}
            onChange={(userId) => setForm((prev) => ({ ...prev, learner_user_id: userId }))}
            fetchOptions={learnerOptions}
            error={fieldErrors.learner_user_id}
          />

          <Autocomplete
            label={t('academy.seller')}
            placeholder={t('academy.searchSellerPlaceholder')}
            value={form.seller_user_id}
            onChange={(userId) => setForm((prev) => ({ ...prev, seller_user_id: userId }))}
            fetchOptions={sellerOptions}
            error={fieldErrors.seller_user_id}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('common.notes')}
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!statusModal}
        onClose={() => setStatusModal(null)}
        title={t('academy.changeStatus')}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('common.status')}
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as EnrollmentStatus)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStatusModal(null)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleStatusUpdate}>
              {t('common.save')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
