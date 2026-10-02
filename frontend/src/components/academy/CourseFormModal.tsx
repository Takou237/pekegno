import { useEffect, useState, type FormEvent } from 'react';
import { Check, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Course } from '@/api/academy.api';
import { uploadsApi } from '@/api/uploads.api';
import { courseCategoriesApi } from '@/api/courseCategories.api';
import { countriesApi } from '@/api/countries.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CourseCategoryFormModal } from '@/components/courseCategories/CourseCategoryFormModal';
import { CountryDeployPicker } from '@/components/countries/CountryDeployPicker';
import { courseModeLabel } from '@/utils/courseMode';
import type { CourseCategory } from '@/types/category';
import type { CountryStat } from '@/types/stats';

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
  cover_image: string | null;
  presentation_video: string;
  is_active: boolean;
  target_country_ids: string[];
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
  cover_image: null,
  presentation_video: '',
  is_active: true,
  target_country_ids: [],
};

function formFromCourse(course: Course): FormState {
  return {
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
    cover_image: course.cover_image ?? null,
    presentation_video: course.presentation_video ?? '',
    is_active: course.is_active,
    target_country_ids: [],
  };
}

interface CourseFormModalProps {
  isOpen: boolean;
  /** null = création. */
  course: Course | null;
  /** Agence de création ; absente (page pays) : la formation n'est créée que dans les pays cochés. */
  agencyId?: string;
  /** Pays de la page / de l'agence, signalé « (pays actuel) » et coché par défaut. */
  currentCountryId?: string;
  onClose: () => void;
  onSaved: (course: Course, created: boolean) => void;
  /** Prévient la page qu'une catégorie a été créée depuis le formulaire (filtres…). */
  onCategoryCreated?: (category: CourseCategory) => void;
}

/**
 * Formulaire complet de création / modification d'une formation, partagé par
 * le catalogue Academy et les pages Services / Produits.
 */
export function CourseFormModal({
  isOpen,
  course,
  agencyId,
  currentCountryId,
  onClose,
  onSaved,
  onCategoryCreated,
}: CourseFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const editing = course;

  const [form, setForm] = useState<FormState>(emptyForm);
  const [categories, setCategories] = useState<CourseCategory[]>([]);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [categoryFormOpen, setCategoryFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setForm(course ? formFromCourse(course) : emptyForm);
    setFormError(null);
    setFieldErrors({});
    courseCategoriesApi
      .list({ per_page: 100 })
      .then((res) => setCategories(res.data))
      .catch(() => {});
    countriesApi
      .list({ per_page: 100 })
      .then((res) => {
        setCountries(res.data);
        if (course) return;
        // Par défaut la formation est déployée dans tous les pays (ticket T12) ;
        // l'utilisateur décoche ceux qui ne sont pas concernés.
        const allCountryIds = res.data.filter((c) => c.is_active).map((c) => c.id);
        setForm((prev) => ({
          ...prev,
          target_country_ids: allCountryIds.length ? allCountryIds : currentCountryId ? [currentCountryId] : [],
        }));
      })
      .catch(() => {
        if (!course && currentCountryId) setForm((prev) => ({ ...prev, target_country_ids: [currentCountryId] }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, course]);

  function handleCategorySaved(saved: CourseCategory) {
    setCategories((prev) => (prev.some((c) => c.id === saved.id) ? prev : [...prev, saved]));
    setForm((prev) =>
      prev.category_ids.includes(saved.id) ? prev : { ...prev, category_ids: [...prev.category_ids, saved.id] }
    );
    onCategoryCreated?.(saved);
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadsApi.upload(file);
      setForm((prev) => ({ ...prev, cover_image: result.url }));
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.uploadFailed')), 'error');
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
      cover_image: form.cover_image,
      presentation_video: form.presentation_video.trim() || null,
      agency_id: editing ? editing.agency_id ?? agencyId : agencyId,
      is_active: form.is_active,
      is_public: true,
      ...(editing
        ? {}
        : { target_country_ids: form.target_country_ids.length ? form.target_country_ids : undefined }),
    };

    try {
      const saved = editing
        ? await academyApi.updateCourse(editing.id, payload)
        : await academyApi.createCourse(payload);
      showToast(t('academy.saved'), 'success');
      onSaved(saved, !editing);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
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
                  {courseModeLabel(m, t)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.categories')}
            </label>
            {categories.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('courseCategories.empty')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const selected = form.category_ids.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({
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
            )}
            <button
              type="button"
              onClick={() => setCategoryFormOpen(true)}
              className="inline-flex w-fit items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              <Plus className="h-4 w-4" />
              {t('courseCategories.newCategory')}
            </button>
            {fieldErrors.category_ids && (
              <p className="text-sm text-error-500">{fieldErrors.category_ids}</p>
            )}
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

          <Input
            label={t('academy.presentationVideo')}
            value={form.presentation_video}
            onChange={(e) => setForm((prev) => ({ ...prev, presentation_video: e.target.value }))}
            error={fieldErrors.presentation_video}
            placeholder="https://..."
          />

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('academy.coverImage')}
            </label>
            {form.cover_image && (
              <div className="relative w-40 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
                <img src={form.cover_image} alt={form.name} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, cover_image: null }))}
                  className="absolute right-1 top-1 rounded-lg bg-gray-900/70 p-1 text-white hover:bg-gray-900"
                  title={t('academy.removeCover')}
                >
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
              {isUploading ? t('academy.uploading') : t('academy.uploadCover')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                disabled={isUploading}
                onChange={(e) => {
                  handleCoverUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
            {fieldErrors.cover_image && (
              <p className="text-sm text-error-500">{fieldErrors.cover_image}</p>
            )}
          </div>

          {!editing && (
            <CountryDeployPicker
              countries={countries}
              selectedIds={form.target_country_ids}
              onChange={(ids) => setForm((prev) => ({ ...prev, target_country_ids: ids }))}
              currentCountryId={currentCountryId}
              hint={t('academy.deployCountriesHint')}
              error={fieldErrors.target_country_ids}
            />
          )}

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>

      <CourseCategoryFormModal
        isOpen={categoryFormOpen}
        category={null}
        onClose={() => setCategoryFormOpen(false)}
        onSaved={handleCategorySaved}
      />
    </>
  );
}
