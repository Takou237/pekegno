import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Layers, Users, CalendarDays, BookOpenCheck, Globe, Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course } from '@/api/academy.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';
import type { Department } from '@/types/department';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

function modeLabel(mode: Course['mode'], t: ReturnType<typeof useTranslation>['t']): string {
  switch (mode) {
    case 'online':
      return t('academy.modeOnline');
    case 'mixed':
      return t('academy.modeMixed');
    default:
      return t('academy.modeInPerson');
  }
}

interface FormState {
  name: string;
  description: string;
  objective: string;
  prerequisites: string;
  mode: Course['mode'];
  price: string;
  duration_hours: string;
  duration_type: 'limited' | 'unlimited';
  duration_months: string;
  category_ids: string[];
}

const emptyForm: FormState = {
  name: '',
  description: '',
  objective: '',
  prerequisites: '',
  mode: 'in_person',
  price: '',
  duration_hours: '',
  duration_type: 'unlimited',
  duration_months: '',
  category_ids: [],
};

export default function AcademyCoursesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();
  const { departmentId } = useParams<{ departmentId: string }>();
  const [courses, setCourses] = useState<Course[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchCourses = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.courses({
        agency_id: agencyId,
        search: search || undefined,
        page,
        per_page: 12,
      });
      setCourses(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, search, page, t]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchCourses();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setForm({
      name: course.name,
      description: course.description ?? '',
      objective: course.objective ?? '',
      prerequisites: course.prerequisites ?? '',
      mode: course.mode,
      price: course.price != null ? String(course.price) : '',
      duration_hours: course.duration_hours != null ? String(course.duration_hours) : '',
      duration_type: course.duration_type ?? 'unlimited',
      duration_months: course.duration_months != null ? String(course.duration_months) : '',
      category_ids: course.categories?.map((c) => c.id) ?? [],
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
      name: form.name,
      description: form.description || null,
      objective: form.objective || null,
      prerequisites: form.prerequisites || null,
      mode: form.mode,
      price: form.price ? Number(form.price) : null,
      duration_hours: form.duration_hours ? Number(form.duration_hours) : null,
      duration_type: form.duration_type,
      duration_months: form.duration_type === 'limited' && form.duration_months ? Number(form.duration_months) : null,
      category_ids: form.category_ids.length > 0 ? form.category_ids : undefined,
      agency_id: agencyId,
    };

    try {
      if (editing) {
        const saved = await academyApi.updateCourse(editing.id, payload);
        setCourses((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      } else {
        const saved = await academyApi.createCourse(payload);
        setCourses((prev) => [saved, ...prev]);
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

  async function handleDelete(course: Course) {
    if (!window.confirm(t('academy.deleteCourseConfirm', { name: course.name }))) return;
    try {
      await academyApi.removeCourse(course.id);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      showToast(t('academy.courseDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.courses')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.coursesSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newCourse')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('academy.searchCoursePlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : courses.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noCourses')}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900"
              >
                {/* Header : nom, code, statuts */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-gray-900 dark:text-white">{course.name}</p>
                    <p className="font-mono text-xs text-gray-400">{course.code}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {course.availability === 'global' ? (
                      <span title={t('academy.availabilityGlobal')}>
                        <Globe className="h-3.5 w-3.5 text-sky-500" />
                      </span>
                    ) : (
                      <span title={t('academy.availabilityAgency')}>
                        <Building2 className="h-3.5 w-3.5 text-gray-400" />
                      </span>
                    )}
                    {!course.is_active && <Badge variant="neutral">{t('common.inactive')}</Badge>}
                  </div>
                </div>

                {/* Description */}
                {course.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                    {course.description}
                  </p>
                )}

                {/* Catégories */}
                {course.categories && course.categories.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {course.categories.map((cat) => (
                      <span
                        key={cat.id}
                        className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: cat.color ? `${cat.color}20` : undefined,
                          color: cat.color ?? undefined,
                          border: cat.color ? `1px solid ${cat.color}40` : '1px solid #e5e7eb',
                        }}
                      >
                        {cat.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Mode + Prix + Durée */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <Badge variant="brand">{modeLabel(course.mode, t)}</Badge>
                  {course.effective_price && course.effective_price !== String(course.price) && (
                    <span className="font-medium text-success-600 dark:text-success-400">
                      {formatCurrency(Number(course.effective_price))}
                    </span>
                  )}
                  {!course.effective_price && course.price != null && (
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      {formatCurrency(course.price)}
                    </span>
                  )}
                  {course.duration_hours != null && (
                    <span className="inline-flex items-center gap-1">
                      {course.duration_hours} {t('academy.hours')}
                      <Badge variant={course.duration_type === 'limited' ? 'warning' : 'neutral'}>
                        {course.duration_type === 'limited' ? t('academy.limited') : t('academy.unlimited')}
                      </Badge>
                    </span>
                  )}
                </div>

                {/* Objectif */}
                {course.objective && (
                  <p className="mt-1 text-xs italic text-gray-400 dark:text-gray-500 line-clamp-1">{course.objective}</p>
                )}

                {/* Compteurs : sessions / modules / inscriptions */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/50">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <CalendarDays className="h-3 w-3" />{t('nav.sessions')}
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {course.sessions_count ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 border-x border-gray-200 dark:border-gray-700">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Layers className="h-3 w-3" />{t('academy.modules')}
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {course.modules_count ?? 0}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Users className="h-3 w-3" />{t('nav.learners')}
                    </span>
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-100">
                      {course.formation_enrollments_count ?? 0}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3 dark:border-gray-800">
                  <Link
                    to={`/departments/${departmentId}/courses/${course.id}/modules`}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                    title={t('academy.modules')}
                  >
                    <BookOpenCheck className="h-4 w-4" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => openEdit(course)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                    title={t('common.edit')}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(course)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                    title={t('common.delete')}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {meta && meta.last_page > 1 && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={12}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('academy.editCourse') : t('academy.newCourse')}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <Input
            label={t('academy.courseName')}
            required
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            error={fieldErrors.name}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.mode')}
            </label>
            <select
              value={form.mode}
              onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value as Course['mode'] }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {(['in_person', 'online', 'mixed'] as const).map((m) => (
                <option key={m} value={m}>
                  {modeLabel(m, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('academy.price')}
              type="number"
              min="0"
              step="1"
              value={form.price}
              onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
              error={fieldErrors.price}
            />
            <Input
              label={t('academy.duration')}
              type="number"
              min="1"
              value={form.duration_hours}
              onChange={(e) => setForm((prev) => ({ ...prev, duration_hours: e.target.value }))}
              error={fieldErrors.duration_hours}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.description')}
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.objective')}
            </label>
            <textarea
              value={form.objective}
              onChange={(e) => setForm((prev) => ({ ...prev, objective: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.prerequisites')}
            </label>
            <textarea
              value={form.prerequisites}
              onChange={(e) => setForm((prev) => ({ ...prev, prerequisites: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('academy.durationType')}
              </label>
              <select
                value={form.duration_type}
                onChange={(e) => setForm((prev) => ({ ...prev, duration_type: e.target.value as 'limited' | 'unlimited' }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              >
                <option value="limited">{t('academy.limited')}</option>
                <option value="unlimited">{t('academy.unlimited')}</option>
              </select>
            </div>
            {form.duration_type === 'limited' && (
              <Input
                label={t('academy.durationMonths')}
                type="number"
                min="1"
                value={form.duration_months}
                onChange={(e) => setForm((prev) => ({ ...prev, duration_months: e.target.value }))}
                error={fieldErrors.duration_months}
              />
            )}
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
    </div>
  );
}
