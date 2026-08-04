import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { categoriesApi } from '@/api/categories.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CATEGORY_ICON_NAMES, CategoryIcon } from '@/utils/categoryIcons';
import type { Category, CategoryPayload } from '@/types/category';

const emptyForm: CategoryPayload = {
  name: '',
  description: '',
  color: '',
  icon: '',
};

interface CategoryFormModalProps {
  isOpen: boolean;
  category: Category | null; // null = création
  onClose: () => void;
  onSaved: (category: Category) => void;
}

export function CategoryFormModal({ isOpen, category, onClose, onSaved }: CategoryFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = category !== null;

  const [form, setForm] = useState<CategoryPayload>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(
        category
          ? {
              name: category.name,
              description: category.description ?? '',
              color: category.color ?? '',
              icon: category.icon ?? '',
            }
          : emptyForm
      );
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, category]);

  function update<K extends keyof CategoryPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): CategoryPayload {
    const payload: CategoryPayload = { name: form.name.trim() };
    if ((form.description ?? '').trim()) payload.description = form.description?.trim() ?? '';
    if ((form.color ?? '').trim()) payload.color = form.color?.trim() ?? '';
    if ((form.icon ?? '').trim()) payload.icon = form.icon?.trim() ?? '';
    return payload;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload();
      const saved = isEditing
        ? await categoriesApi.update(category.id, payload)
        : await categoriesApi.create(payload);

      showToast(
        isEditing ? t('categories.updated') : t('categories.saved'),
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('categories.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('categories.editTitle') : t('categories.createTitle')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <Input
          label={t('categories.name')}
          required
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          error={fieldErrors.name}
          placeholder={t('categories.namePlaceholder')}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('categories.description')}
          </label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder={t('categories.descriptionPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {fieldErrors.description && (
            <p className="text-sm text-error-500">{fieldErrors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('categories.color')}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.color || '#3B82F6'}
                onChange={(e) => update('color', e.target.value)}
                className="h-10 w-14 cursor-pointer rounded-lg border border-gray-300 bg-transparent p-1 dark:border-gray-700"
              />
              <input
                type="text"
                value={form.color ?? ''}
                onChange={(e) => update('color', e.target.value)}
                placeholder="#3B82F6"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700"
              style={{ backgroundColor: form.color || '#CBD5E1' }}
            >
              <CategoryIcon name={form.icon || undefined} className="h-6 w-6 text-white" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('categories.icon')}
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ICON_NAMES.map((iconName) => {
                const selected = form.icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => update('icon', selected ? '' : iconName)}
                    title={iconName}
                    className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                      selected
                        ? 'border-brand-500 bg-brand-500/10 text-brand-600 ring-2 ring-brand-500/30 dark:text-brand-400'
                        : 'border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 dark:border-gray-700 dark:hover:border-brand-400'
                    }`}
                  >
                    <CategoryIcon name={iconName} className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
            {fieldErrors.icon && <p className="text-sm text-error-500">{fieldErrors.icon}</p>}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="flex-1">
            {isEditing ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
