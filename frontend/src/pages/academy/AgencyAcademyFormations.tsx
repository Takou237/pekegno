import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Search, GraduationCap, Plus, UserPlus, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course } from '@/api/academy.api';
import { courseCategoriesApi } from '@/api/courseCategories.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import FormationEnrollmentModal from '@/components/academy/FormationEnrollmentModal';
import { canCreateCourse, canEnrollLearners } from '@/utils/academyPermissions';
import { formatCurrency } from '@/utils/number';
import type { CourseCategory } from '@/types/category';
import type { FormationEnrollment } from '@/types/formation';

interface AgencyAcademyFormationsProps {
  agencyId: string;
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

interface CourseFormState {
  name: string;
  mode: Course['mode'];
  category_ids: string[];
  price: string;
  description: string;
}

const emptyCourseForm: CourseFormState = {
  name: '',
  mode: 'in_person',
  category_ids: [],
  price: '',
  description: '',
};

export default function AgencyAcademyFormations({ agencyId }: AgencyAcademyFormationsProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; per_page: number } | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);
  const [courseSubmitting, setCourseSubmitting] = useState(false);
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [courseFieldErrors, setCourseFieldErrors] = useState<Record<string, string>>({});
  const [enrollOpen, setEnrollOpen] = useState(false);

  useEffect(() => {
    courseCategoriesApi
      .list({ per_page: 100 })
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const fetchCourses = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.courses({
        agency_id: agencyId,
        search: search || undefined,
        mode: filterMode ? (filterMode as Course['mode']) : undefined,
        categories: filterCategory ? [filterCategory] : undefined,
        page,
        per_page: 9,
      });
      setCourses(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(t('academy.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, search, filterMode, filterCategory, page, t]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchCourses();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterMode, filterCategory]);

  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function openCourseForm() {
    setCourseForm(emptyCourseForm);
    setCourseFormError(null);
    setCourseFieldErrors({});
    setCourseFormOpen(true);
  }

  async function handleCreateCourse(event: FormEvent) {
    event.preventDefault();
    setCourseSubmitting(true);
    setCourseFormError(null);
    setCourseFieldErrors({});
    try {
      const saved = await academyApi.createCourse({
        name: courseForm.name,
        mode: courseForm.mode,
        category_ids: courseForm.category_ids.length > 0 ? courseForm.category_ids : undefined,
        price: courseForm.price ? Number(courseForm.price) : null,
        description: courseForm.description || null,
        agency_id: agencyId,
      });
      showToast(t('academy.saved'), 'success');
      setCourses((prev) => [saved, ...prev]);
      setCourseFormOpen(false);
    } catch (error) {
      setCourseFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setCourseFieldErrors(extractFieldErrors(error));
    } finally {
      setCourseSubmitting(false);
    }
  }

  function handleEnrollmentSaved(_enrollment: FormationEnrollment) {
    fetchCourses();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <GraduationCap className="h-4 w-4" />
          {t('academy.coursesSubtitle')}
        </p>
        <div className="flex flex-wrap gap-3">
          {canEnrollLearners(user) && (
            <Button variant="outline" onClick={() => setEnrollOpen(true)}>
              <UserPlus className="h-4 w-4" />
              {t('academy.newEnrollment')}
            </Button>
          )}
          {canCreateCourse(user) && (
            <Button onClick={openCourseForm}>
              <Plus className="h-4 w-4" />
              {t('academy.newCourse')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 lg:flex-row lg:items-end">
        <div className="flex-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('academy.searchCoursePlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('academy.filterByMode')}
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
          >
            <option value="">{t('academy.allModes')}</option>
            <option value="in_person">{t('academy.modeInPerson')}</option>
            <option value="online">{t('academy.modeOnline')}</option>
            <option value="mixed">{t('academy.modeMixed')}</option>
          </Select>
        </div>
        <div className="sm:w-48">
          <Select
            label={t('academy.filterByCategory')}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">{t('academy.allCategories')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonCards />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : courses.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noCourses')}</p>
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex h-24 w-full shrink-0 items-center justify-center bg-gradient-to-br from-brand-100 to-brand-200 dark:from-gray-800 dark:to-gray-700">
                  <GraduationCap className="h-8 w-8 text-brand-600 dark:text-brand-400" />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-white">{course.name}</p>
                      <p className="font-mono text-xs text-gray-400">{course.code}</p>
                    </div>
                    <Badge variant="neutral">{modeLabel(course.mode, t)}</Badge>
                  </div>

                  {course.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
                      {course.description}
                    </p>
                  )}

                  <div className="mt-3 flex items-baseline gap-2">
                    {course.effective_price != null ? (
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(course.effective_price)}
                      </span>
                    ) : course.price != null ? (
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(course.price)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                    {course.effective_price != null &&
                      course.price != null &&
                      Number(course.effective_price) < Number(course.price) && (
                        <span className="text-sm text-gray-400 line-through">
                          {formatCurrency(course.price)}
                        </span>
                      )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-gray-50 px-3 py-2 text-center dark:bg-gray-800/50">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {course.sessions_count ?? 0}
                      </p>
                      <p className="text-[11px] text-gray-400">{t('nav.sessions')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {course.modules_count ?? 0}
                      </p>
                      <p className="text-[11px] text-gray-400">{t('academy.modules')}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                        {course.formation_enrollments_count ?? 0}
                      </p>
                      <p className="text-[11px] text-gray-400">{t('nav.learners')}</p>
                    </div>
                  </div>
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
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={courseFormOpen}
        onClose={() => setCourseFormOpen(false)}
        title={t('academy.newCourse')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCreateCourse} className="flex flex-col gap-4">
          {courseFormError && <Alert variant="error">{courseFormError}</Alert>}

          <Input
            label={t('academy.courseName')}
            required
            value={courseForm.name}
            onChange={(e) => setCourseForm((prev) => ({ ...prev, name: e.target.value }))}
            error={courseFieldErrors.name}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.mode')}
            </label>
            <select
              value={courseForm.mode}
              onChange={(e) => setCourseForm((prev) => ({ ...prev, mode: e.target.value as Course['mode'] }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {(['in_person', 'online', 'mixed'] as const).map((m) => (
                <option key={m} value={m}>
                  {modeLabel(m, t)}
                </option>
              ))}
            </select>
          </div>

          {categories.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('academy.categories')}
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = courseForm.category_ids.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setCourseForm((prev) => ({
                          ...prev,
                          category_ids: selected
                            ? prev.category_ids.filter((id) => id !== cat.id)
                            : [...prev.category_ids, cat.id],
                        }))
                      }
                      title={cat.name}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                        selected
                          ? 'text-white shadow-sm'
                          : 'border-gray-300 text-gray-600 hover:border-brand-400 dark:border-gray-700 dark:text-gray-300'
                      }`}
                      style={
                        selected
                          ? { backgroundColor: cat.color ?? '#3B82F6', borderColor: cat.color ?? '#3B82F6' }
                          : undefined
                      }
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              {courseFieldErrors.category_ids && (
                <p className="text-sm text-error-500">{courseFieldErrors.category_ids}</p>
              )}
            </div>
          )}

          <Input
            label={t('academy.price')}
            type="number"
            min="0"
            step="1"
            value={courseForm.price}
            onChange={(e) => setCourseForm((prev) => ({ ...prev, price: e.target.value }))}
            error={courseFieldErrors.price}
          />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.description')}
            </label>
            <textarea
              value={courseForm.description}
              onChange={(e) => setCourseForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setCourseFormOpen(false)} disabled={courseSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={courseSubmitting} className="flex-1">
              {t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <FormationEnrollmentModal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        agencyId={agencyId}
        onSaved={handleEnrollmentSaved}
      />
    </div>
  );
}
