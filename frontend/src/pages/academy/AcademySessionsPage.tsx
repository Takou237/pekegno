import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  academyApi,
  type SessionStatus,
  type TrainingSession,
} from '@/api/academy.api';
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

const STATUSES: SessionStatus[] = ['planned', 'ongoing', 'completed', 'cancelled'];

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

interface FormState {
  course_id: string;
  trainer_id: string;
  start_at: string;
  end_at: string;
  location: string;
  max_capacity: string;
  price: string;
  status: SessionStatus;
}

const emptyForm: FormState = {
  course_id: '',
  trainer_id: '',
  start_at: '',
  end_at: '',
  location: '',
  max_capacity: '',
  price: '',
  status: 'planned',
};

function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function AcademySessionsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<AgencyLayoutContext>();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | SessionStatus>('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingSession | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchSessions = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.sessions({
        agency_id: agencyId,
        status: statusFilter || undefined,
        page,
        per_page: 15,
      });
      setSessions(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, statusFilter, page, t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Options d'autocomplétion du formulaire : formations et formateurs de l'agence.
  const courseOptions = useCallback(
    async (query: string) => {
      if (!agencyId) return [];
      const response = await academyApi.courses({
        agency_id: agencyId,
        search: query.trim() || undefined,
        per_page: 20,
      });
      return response.data.map((course) => ({
        id: course.id,
        label: course.name,
        subtitle: course.code,
      }));
    },
    [agencyId],
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

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(session: TrainingSession) {
    setEditing(session);
    setForm({
      course_id: session.course?.id ?? '',
      trainer_id: session.trainer?.id ?? '',
      start_at: toDatetimeLocal(session.start_at),
      end_at: toDatetimeLocal(session.end_at),
      location: session.location ?? '',
      max_capacity: session.max_capacity != null ? String(session.max_capacity) : '',
      price: session.price != null ? String(session.price) : '',
      status: session.status,
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

    const payload = {
      course_id: form.course_id,
      trainer_id: form.trainer_id || null,
      agency_id: agencyId,
      start_at: form.start_at,
      end_at: form.end_at || null,
      location: form.location || null,
      max_capacity: form.max_capacity ? Number(form.max_capacity) : null,
      price: form.price ? Number(form.price) : null,
      status: form.status,
    };

    try {
      if (editing) {
        const saved = await academyApi.updateSession(editing.id, payload);
        setSessions((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      } else {
        const saved = await academyApi.createSession(payload);
        setSessions((prev) => [saved, ...prev]);
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

  async function handleDelete(session: TrainingSession) {
    if (!window.confirm(t('academy.deleteSessionConfirm'))) return;
    try {
      await academyApi.removeSession(session.id);
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      showToast(t('academy.sessionDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  function trainerName(trainer: TrainingSession['trainer']): string {
    if (!trainer) return '—';
    return [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') || trainer.email;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.sessions')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.sessionsSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newSession')}
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
        ) : sessions.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noSessions')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('nav.courses')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.trainers')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.sessionDate')}</th>
                  <th className="px-5 py-3 font-medium">{t('academy.enrollmentsCount')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {sessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-100">
                        {session.course?.name ?? '—'}
                      </span>
                      {session.course?.code && (
                        <span className="ml-2 font-mono text-xs text-gray-400">{session.course.code}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{trainerName(session.trainer)}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {new Date(session.start_at).toLocaleString(currentLocale(), {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {session.enrollments_count ?? 0}
                      {session.max_capacity != null && ` / ${session.max_capacity}`}
                    </td>
                    <td className="px-5 py-3">{statusBadge(session.status, t)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(session)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(session)}
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
        title={editing ? t('academy.editSession') : t('academy.newSession')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Autocomplete
            label={`${t('nav.courses')} *`}
            placeholder={t('academy.searchCoursePlaceholder')}
            value={form.course_id}
            onChange={(courseId) => setForm((prev) => ({ ...prev, course_id: courseId }))}
            fetchOptions={courseOptions}
            error={fieldErrors.course_id}
          />

          <Autocomplete
            label={t('nav.trainers')}
            placeholder={t('academy.searchTrainerPlaceholder')}
            value={form.trainer_id}
            onChange={(trainerId) => setForm((prev) => ({ ...prev, trainer_id: trainerId }))}
            fetchOptions={trainerOptions}
            error={fieldErrors.trainer_id}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('academy.startAt')}
              type="datetime-local"
              required
              value={form.start_at}
              onChange={(e) => setForm((prev) => ({ ...prev, start_at: e.target.value }))}
              error={fieldErrors.start_at}
            />
            <Input
              label={t('academy.endAt')}
              type="datetime-local"
              value={form.end_at}
              onChange={(e) => setForm((prev) => ({ ...prev, end_at: e.target.value }))}
              error={fieldErrors.end_at}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('academy.maxCapacity')}
              type="number"
              min="1"
              value={form.max_capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, max_capacity: e.target.value }))}
              error={fieldErrors.max_capacity}
            />
            <Input
              label={t('academy.price')}
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              error={fieldErrors.price}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('academy.location')}
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              error={fieldErrors.location}
            />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.status')}
              </label>
              <select
                value={form.status}
                onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as SessionStatus }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {statusLabel(s, t)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500">{t('academy.sessionPriceHint')}</p>

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
    </div>
  );
}
