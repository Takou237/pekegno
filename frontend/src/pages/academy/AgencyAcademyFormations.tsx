import { useCallback, useEffect, useState } from 'react';
import { Search, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course } from '@/api/academy.api';
import { courseCategoriesApi } from '@/api/courseCategories.api';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { formatCurrency } from '@/utils/number';
import type { CourseCategory } from '@/types/category';

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

export default function AgencyAcademyFormations({ agencyId }: AgencyAcademyFormationsProps) {
  const { t } = useTranslation();

  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; per_page: number } | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <GraduationCap className="h-4 w-4" />
        {t('academy.coursesSubtitle')}
      </p>

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
                    {course.price != null ? (
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(course.price)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
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
    </div>
  );
}
