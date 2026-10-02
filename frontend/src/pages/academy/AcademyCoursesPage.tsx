import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, Layers, Users, CalendarDays, BookOpenCheck, Globe, Building2, Play, Tag, Eye, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course, type CoursePromotion, type CoursePromotionPayload, type CoursePromotionType } from '@/api/academy.api';
import { promotionsApi } from '@/api/promotions.api';
import { courseCategoriesApi } from '@/api/courseCategories.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';
import { getYouTubeEmbedUrl, isYouTubeUrl } from '@/utils/video';
import { currentLocale } from '@/i18n';
import type { Department } from '@/types/department';
import type { CourseCategory } from '@/types/category';
import { canManageAcademyPromotions, canEnrollLearners } from '@/utils/academyPermissions';
import { courseModeLabel } from '@/utils/courseMode';
import FormationEnrollmentModal from '@/components/academy/FormationEnrollmentModal';
import { CourseFormModal } from '@/components/academy/CourseFormModal';
import { CourseCategoryFormModal } from '@/components/courseCategories/CourseCategoryFormModal';

interface DepartmentLayoutContext {
  department?: Department | null;
  departmentId?: string;
  agencyId?: string;
}

interface PromotionFormState {
  type: CoursePromotionType;
  promo_price: string;
  discount_percent: string;
  start_date: string;
  end_date: string;
}

const emptyPromotionForm: PromotionFormState = {
  type: 'amount',
  promo_price: '',
  discount_percent: '',
  start_date: '',
  end_date: '',
};

export default function AcademyCoursesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { department, agencyId } = useOutletContext<DepartmentLayoutContext>();
  const currentCountryId = department?.agency?.country_id ?? undefined;
  const { departmentId } = useParams<{ departmentId: string }>();
  const openCourseDetail = (course: Course) =>
    navigate(`/departments/${departmentId}/courses/${course.id}`);
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterPromotion, setFilterPromotion] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const { user } = useAuth();
  const canManagePromos = canManageAcademyPromotions(user);

  const [promoCourse, setPromoCourse] = useState<Course | null>(null);
  const [promoFormOpen, setPromoFormOpen] = useState(false);
  const [promoEditing, setPromoEditing] = useState<CoursePromotion | null>(null);
  const [promoForm, setPromoForm] = useState<PromotionFormState>(emptyPromotionForm);
  const [promoFieldErrors, setPromoFieldErrors] = useState<Record<string, string>>({});
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  const [promoDeleteTarget, setPromoDeleteTarget] = useState<CoursePromotion | null>(null);
  const [promoDeleting, setPromoDeleting] = useState(false);

  const [detailCourse, setDetailCourse] = useState<Course | null>(null);
  // Inscription depuis le catalogue : modal pré-rempli avec le cours choisi.
  const [enrollCourse, setEnrollCourse] = useState<Course | null>(null);

  const fetchCourses = useCallback(async () => {
    if (!agencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.courses({
        agency_id: agencyId,
        search: search || undefined,
        mode: (filterMode || undefined) as Course['mode'] | undefined,
        categories: filterCategory ? [filterCategory] : undefined,
        promotion: (filterPromotion || undefined) as 'active' | 'none' | undefined,
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
  }, [agencyId, search, page, t, filterCategory, filterMode, filterPromotion]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      fetchCourses();
    }, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
    }, 350);
    return () => clearTimeout(timeout);
  }, [filterCategory, filterMode, filterPromotion]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await courseCategoriesApi.list({ per_page: 100 });
      setCategories(response.data);
    } catch {
      // La liste reste vide si le chargement des catégories échoue.
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function handleCategorySaved(saved: CourseCategory) {
    setCategories((prev) =>
      prev.some((c) => c.id === saved.id) ? prev : [...prev, saved]
    );
  }

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setFormOpen(true);
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

  function toDateInput(value: string): string {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function statusOf(promotion: CoursePromotion): 'active' | 'upcoming' | 'expired' {
    if (promotion.is_active) return 'active';
    return new Date(promotion.end_date) > new Date() ? 'upcoming' : 'expired';
  }

  function activePromotion(course: Course): CoursePromotion | undefined {
    return (course.promotions ?? [])
      .filter((p) => p.is_active)
      .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  }

  function discountPercent(course: Course): number | null {
    const promotion = activePromotion(course);
    if (!promotion) return null;
    if (promotion.type === 'percent' && promotion.discount_percent != null) {
      return Number(promotion.discount_percent);
    }
    if (promotion.type === 'amount' && promotion.promo_price != null) {
      const original = Number(course.price);
      const promo = Number(promotion.promo_price);
      if (original > 0 && promo < original) {
        return Math.round(((original - promo) / original) * 100);
      }
    }
    return null;
  }

  function openPromoCreate(course: Course) {
    setPromoCourse(course);
    setPromoEditing(null);
    setPromoForm(emptyPromotionForm);
    setPromoFieldErrors({});
    setPromoFormOpen(true);
  }

  function openPromoEdit(promotion: CoursePromotion, course: Course) {
    setPromoCourse(course);
    setPromoEditing(promotion);
    setPromoForm({
      type: promotion.type,
      promo_price: promotion.promo_price ?? '',
      discount_percent: promotion.discount_percent ?? '',
      start_date: toDateInput(promotion.start_date),
      end_date: toDateInput(promotion.end_date),
    });
    setPromoFieldErrors({});
    setPromoFormOpen(true);
  }

  function replacePromotions(courseId: string, promotions: CoursePromotion[]) {
    setCourses((prev) =>
      prev.map((c) => (c.id === courseId ? { ...c, promotions } : c))
    );
    setPromoCourse((prev) => (prev && prev.id === courseId ? { ...prev, promotions } : prev));
  }

  async function handlePromoSubmit(event: FormEvent) {
    event.preventDefault();
    if (!promoCourse) return;
    setPromoFieldErrors({});
    setPromoSubmitting(true);

    const payload: CoursePromotionPayload = {
      type: promoForm.type,
      promo_price: promoForm.type === 'amount' ? promoForm.promo_price : null,
      discount_percent: promoForm.type === 'percent' ? promoForm.discount_percent : null,
      start_date: promoForm.start_date,
      end_date: promoForm.end_date,
    };

    try {
      if (promoEditing) {
        const saved = await promotionsApi.update(promoEditing.id, {
          type: payload.type,
          promo_price: payload.promo_price ?? undefined,
          discount_percent: payload.discount_percent ?? undefined,
          start_date: payload.start_date,
          end_date: payload.end_date,
        });
        const updated: CoursePromotion = {
          ...promoEditing,
          ...saved,
          id: promoEditing.id,
          formation_id: promoEditing.formation_id,
          start_date: saved.start_date,
          end_date: saved.end_date,
        };
        replacePromotions(
          promoCourse.id,
          (promoCourse.promotions ?? []).map((p) => (p.id === updated.id ? updated : p))
        );
        showToast(t('promotions.updated'), 'success');
      } else {
        const created = await academyApi.createFormationPromotion(promoCourse.id, payload);
        replacePromotions(promoCourse.id, [...(promoCourse.promotions ?? []), created]);
        showToast(t('promotions.created'), 'success');
      }
      setPromoFormOpen(false);
    } catch (error) {
      const fieldErrors = extractFieldErrors(error) as Record<string, string>;
      setPromoFieldErrors(fieldErrors);
      if (Object.keys(fieldErrors).length === 0) {
        showToast(extractErrorMessage(error, t('promotions.saveFailed')), 'error');
      }
    } finally {
      setPromoSubmitting(false);
    }
  }

  async function handlePromoDelete() {
    if (!promoDeleteTarget || !promoCourse) return;
    setPromoDeleting(true);
    try {
      await promotionsApi.remove(promoDeleteTarget.id);
      showToast(t('promotions.deleted'), 'success');
      replacePromotions(
        promoCourse.id,
        (promoCourse.promotions ?? []).filter((p) => p.id !== promoDeleteTarget.id)
      );
      setPromoDeleteTarget(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('promotions.deleteFailed')), 'error');
    } finally {
      setPromoDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.courses')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.coursesSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setCategoryFormOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('courseCategories.newCategory')}
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            {t('academy.newCourse')}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('academy.searchCoursePlaceholder')}
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label={t('academy.filterByCategory')}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="">{t('academy.allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            aria-label={t('academy.filterByMode')}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="">{t('academy.allModes')}</option>
            <option value="online">{t('academy.modeOnline')}</option>
            <option value="in_person">{t('academy.modeInPerson')}</option>
            <option value="mixed">{t('academy.modeMixed')}</option>
          </select>

          <select
            value={filterPromotion}
            onChange={(e) => setFilterPromotion(e.target.value)}
            aria-label={t('academy.filterByPromotion')}
            className="h-11 rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="">{t('academy.allPromotions')}</option>
            <option value="active">{t('academy.withPromotion')}</option>
            <option value="none">{t('academy.withoutPromotion')}</option>
          </select>
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
                onClick={() => {
                  setDetailCourse(null);
                  openCourseDetail(course);
                }}
                className="flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white transition-shadow hover:border-brand-200 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-brand-500/40"
              >
                {/* Couverture */}
                {course.cover_image ? (
                  <div className="relative h-32 w-full shrink-0">
                    <div
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${course.cover_image})` }}
                      role="img"
                      aria-label={course.name}
                    />
                    {course.presentation_video && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-brand-600 shadow-lg">
                          <Play className="ml-0.5 h-5 w-5" />
                        </span>
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex h-32 w-full shrink-0 items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700">
                    <span className="text-sm font-bold uppercase tracking-[0.35em] text-gray-400 dark:text-gray-600">
                      PEKEGNO
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col p-5">
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
                      <span title={t('academy.isPublic')}>
                        <Eye className="h-3.5 w-3.5 text-green-500" />
                      </span>
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

                  {/* Prix effectif / promo */}
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    {course.price != null &&
                    course.effective_price != null &&
                    Number(course.effective_price) !== Number(course.price) ? (
                      <>
                        <span className="text-lg font-semibold text-success-600 dark:text-success-400">
                          {formatCurrency(Number(course.effective_price))}
                        </span>
                        <span className="text-xs text-gray-400 line-through">
                          {formatCurrency(Number(course.price))}
                        </span>
                        {discountPercent(course) != null && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400">
                            -{discountPercent(course)}%
                          </span>
                        )}
                      </>
                    ) : course.price != null ? (
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(course.price)}
                      </span>
                    ) : null}
                  </div>

                  {/* Mode + Durée */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <Badge variant="brand">{courseModeLabel(course.mode, t)}</Badge>
                    {course.duration_hours != null && (
                      <span className="inline-flex items-center gap-1">
                        {course.duration_hours} {t('academy.hours')}
                        <Badge variant={course.duration_type === 'limited' ? 'warning' : 'neutral'}>
                          {course.duration_type === 'limited'
                            ? `${t('academy.limited')}${course.duration_months != null ? ` · ${course.duration_months} ${t('academy.monthsShort')}` : ''}`
                            : t('academy.unlimited')}
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
                    {canEnrollLearners(user) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEnrollCourse(course);
                        }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-green-600 dark:hover:bg-gray-800"
                        title={t('academy.newEnrollment')}
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailCourse(course);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-sky-600 dark:hover:bg-gray-800"
                      title={t('common.viewDetails')}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {canManagePromos && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPromoCreate(course);
                        }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-amber-600 dark:hover:bg-gray-800"
                        title={t('academy.promotions')}
                      >
                        <Tag className="h-4 w-4" />
                      </button>
                    )}
                    <Link
                      to={`/departments/${departmentId}/courses/${course.id}/modules`}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                      title={t('academy.modules')}
                    >
                      <BookOpenCheck className="h-4 w-4" />
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(course);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                      title={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(course);
                      }}
                      className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                      title={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
              perPage={12}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <CourseFormModal
        isOpen={formOpen}
        course={editing}
        agencyId={agencyId}
        currentCountryId={currentCountryId}
        onClose={() => setFormOpen(false)}
        onSaved={(saved, created) =>
          setCourses((prev) => (created ? [saved, ...prev] : prev.map((c) => (c.id === saved.id ? saved : c))))
        }
        onCategoryCreated={handleCategorySaved}
      />

      <CourseCategoryFormModal
        isOpen={categoryFormOpen}
        category={null}
        onClose={() => setCategoryFormOpen(false)}
        onSaved={handleCategorySaved}
      />

      <Modal
        isOpen={Boolean(detailCourse)}
        onClose={() => setDetailCourse(null)}
        title={t('academy.courseDetails')}
        maxWidth="max-w-3xl"
      >
        {detailCourse ? (
          <div className="flex flex-col gap-5">
            <div className="flex gap-4">
              {detailCourse.cover_image ? (
                <img
                  src={detailCourse.cover_image}
                  alt={detailCourse.name}
                  className="h-24 w-24 rounded-xl border border-gray-200 object-cover dark:border-gray-700"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700"
                     style={{ backgroundColor: detailCourse.categories?.[0]?.color ?? '#CBD5E1' }}>
                  <BookOpenCheck className="h-10 w-10 text-white" />
                </div>
              )}
              <div className="flex flex-col justify-center gap-1.5">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{detailCourse.name}</h3>
                <p className="font-mono text-xs text-gray-400">{detailCourse.code}</p>
                {detailCourse.categories && detailCourse.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {detailCourse.categories.map((cat) => (
                      <Badge key={cat.id} variant="brand">{cat.name}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('academy.price')}</dt>
                <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                  {detailCourse.price != null ? formatCurrency(detailCourse.price) : '—'}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('academy.effectivePrice')}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold text-brand-600 dark:text-brand-400">
                  {detailCourse.effective_price != null ? formatCurrency(detailCourse.effective_price) : '—'}
                  {discountPercent(detailCourse) != null && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-500/10 dark:text-green-400">
                      -{discountPercent(detailCourse)}%
                    </span>
                  )}
                </dd>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/50">
                <dt className="text-xs uppercase text-gray-400">{t('academy.duration')}</dt>
                <dd className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                  {detailCourse.duration_hours != null
                    ? `${detailCourse.duration_hours} ${t('academy.hours')}`
                    : '—'}
                </dd>
              </div>
            </div>

            {detailCourse.presentation_video && (
              <div>
                <dt className="mb-2 text-xs uppercase text-gray-400">{t('academy.presentationVideo')}</dt>
                <dd className="mt-1">
                  {isYouTubeUrl(detailCourse.presentation_video) ? (
                    <iframe
                      src={getYouTubeEmbedUrl(detailCourse.presentation_video) ?? undefined}
                      title={detailCourse.name}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className="aspect-video w-full rounded-xl border border-gray-100 bg-black dark:border-gray-800"
                    />
                  ) : (
                    <video
                      src={detailCourse.presentation_video}
                      controls
                      className="aspect-video w-full rounded-xl border border-gray-100 bg-black dark:border-gray-800"
                    />
                  )}
                </dd>
              </div>
            )}

            {detailCourse.description && (
              <div>
                <dt className="text-xs uppercase text-gray-400">{t('academy.description')}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                  {detailCourse.description}
                </dd>
              </div>
            )}

            {detailCourse.objective && (
              <div>
                <dt className="text-xs uppercase text-gray-400">{t('academy.objective')}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                  {detailCourse.objective}
                </dd>
              </div>
            )}

            {detailCourse.prerequisites && (
              <div>
                <dt className="text-xs uppercase text-gray-400">{t('academy.prerequisites')}</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200">
                  {detailCourse.prerequisites}
                </dd>
              </div>
            )}

            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('academy.promotions')}
              </h4>
              {(detailCourse.promotions ?? []).length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                      <tr>
                        <th className="px-4 py-2 font-medium">{t('academy.promoPrice')}</th>
                        <th className="px-4 py-2 font-medium">{t('academy.promoStart')}</th>
                        <th className="px-4 py-2 font-medium">{t('academy.promoEnd')}</th>
                        <th className="px-4 py-2 font-medium">{t('academy.promoStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {detailCourse.promotions?.map((promotion) => {
                        const status = statusOf(promotion);
                        return (
                          <tr key={promotion.id}>
                            <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                              {promotion.type === 'percent' && promotion.discount_percent != null
                                ? `-${promotion.discount_percent}%`
                                : formatCurrency(Number(promotion.promo_price ?? 0))}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                              {new Date(promotion.start_date).toLocaleDateString(currentLocale())}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                              {new Date(promotion.end_date).toLocaleDateString(currentLocale())}
                            </td>
                            <td className="px-4 py-2">
                              {status === 'active' && <Badge variant="success">{t('promotions.active')}</Badge>}
                              {status === 'upcoming' && <Badge variant="brand">{t('promotions.upcoming')}</Badge>}
                              {status === 'expired' && <Badge variant="neutral">{t('promotions.expired')}</Badge>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.noPromotions')}</p>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={promoFormOpen}
        onClose={() => setPromoFormOpen(false)}
        title={promoEditing ? t('academy.editPromotion') : t('academy.newPromotion')}
        maxWidth="max-w-2xl"
      >
        <div className="flex flex-col gap-5">
          {promoCourse && (promoCourse.promotions ?? []).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t('academy.promotions')}
              </h4>
              <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <tr>
                      <th className="px-4 py-2 font-medium">{t('academy.promoPrice')}</th>
                      <th className="px-4 py-2 font-medium">{t('academy.promoStart')}</th>
                      <th className="px-4 py-2 font-medium">{t('academy.promoEnd')}</th>
                      <th className="px-4 py-2 font-medium">{t('academy.promoStatus')}</th>
                      <th className="px-4 py-2 text-right">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {promoCourse.promotions?.map((promotion) => {
                      const status = statusOf(promotion);
                      return (
                        <tr key={promotion.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 font-medium text-gray-800 dark:text-gray-100">
                            {promotion.type === 'percent' && promotion.discount_percent != null
                              ? `-${promotion.discount_percent}%`
                              : formatCurrency(Number(promotion.promo_price ?? 0))}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                            {new Date(promotion.start_date).toLocaleDateString(currentLocale())}
                          </td>
                          <td className="px-4 py-2 text-gray-600 dark:text-gray-300">
                            {new Date(promotion.end_date).toLocaleDateString(currentLocale())}
                          </td>
                          <td className="px-4 py-2">
                            {status === 'active' && <Badge variant="success">{t('promotions.active')}</Badge>}
                            {status === 'upcoming' && <Badge variant="brand">{t('promotions.upcoming')}</Badge>}
                            {status === 'expired' && <Badge variant="neutral">{t('promotions.expired')}</Badge>}
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openPromoEdit(promotion, promoCourse)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                                title={t('common.edit')}
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setPromoDeleteTarget(promotion)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                                title={t('common.delete')}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <form onSubmit={handlePromoSubmit} className="flex flex-col gap-4">
            {Object.keys(promoFieldErrors).length > 0 && (
              <Alert variant="error">{Object.values(promoFieldErrors).join(' ')}</Alert>
            )}

            {promoEditing && promoCourse && (
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('academy.courseName')}
                </label>
                <input
                  type="text"
                  value={promoCourse.name}
                  disabled
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                />
              </div>
            )}

            <Select
              label={t('promotions.type')}
              required
              value={promoForm.type}
              onChange={(e) => setPromoForm((prev) => ({ ...prev, type: e.target.value as CoursePromotionType }))}
              error={promoFieldErrors.type}
            >
              <option value="amount">{t('promotions.typeAmount')}</option>
              <option value="percent">{t('promotions.typePercent')}</option>
            </Select>

            {promoForm.type === 'amount' ? (
              <Input
                label={t('promotions.price')}
                required
                type="number"
                step="0.01"
                min="0"
                value={promoForm.promo_price}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, promo_price: e.target.value }))}
                error={promoFieldErrors.promo_price}
                placeholder="0.00"
              />
            ) : (
              <Input
                label={t('promotions.discountPercent')}
                required
                type="number"
                step="0.01"
                min="0.01"
                max="100"
                value={promoForm.discount_percent}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, discount_percent: e.target.value }))}
                error={promoFieldErrors.discount_percent}
                placeholder="20"
              />
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('promotions.start')}
                required
                type="date"
                value={promoForm.start_date}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, start_date: e.target.value }))}
                error={promoFieldErrors.start_date}
              />
              <Input
                label={t('promotions.end')}
                required
                type="date"
                value={promoForm.end_date}
                onChange={(e) => setPromoForm((prev) => ({ ...prev, end_date: e.target.value }))}
                error={promoFieldErrors.end_date}
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setPromoFormOpen(false)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={promoSubmitting} className="flex-1">
                {promoEditing ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(promoDeleteTarget)}
        onCancel={() => setPromoDeleteTarget(null)}
        onConfirm={handlePromoDelete}
        title={t('promotions.deleteTitle')}
        message={t('promotions.deleteMessage', { service: promoCourse?.name ?? '' })}
        confirmLabel={t('common.delete')}
        variant="danger"
        isLoading={promoDeleting}
      />


      <FormationEnrollmentModal
        isOpen={Boolean(enrollCourse)}
        onClose={() => setEnrollCourse(null)}
        agencyId={agencyId}
        presetCourseId={enrollCourse?.id}
        onSaved={() => {
          setEnrollCourse(null);
          fetchCourses();
        }}
      />
    </div>
  );
}
