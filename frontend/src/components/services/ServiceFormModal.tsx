import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { categoriesApi } from '@/api/categories.api';
import { agenciesApi } from '@/api/agencies.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Category } from '@/types/category';
import type { Agency } from '@/types/agency';
import type { Service, ServicePayload } from '@/types/service';

interface ServiceFormState {
  name: string;
  category_id: string;
  agency_id: string;
  price: string;
  description: string;
  cover_image: string | null;
  presentation_video: string;
}

function emptyForm(categoryId: string, agencyId = ''): ServiceFormState {
  return {
    name: '',
    category_id: categoryId,
    agency_id: agencyId,
    price: '',
    description: '',
    cover_image: null,
    presentation_video: '',
  };
}

interface ServiceFormModalProps {
  isOpen: boolean;
  service: Service | null; // null = création
  duplicateSource?: Service | null; // pré-remplit le formulaire en mode création
  agencyId?: string;
  onClose: () => void;
  onSaved: (service: Service) => void;
}

export function ServiceFormModal({
  isOpen,
  service,
  duplicateSource,
  agencyId,
  onClose,
  onSaved,
}: ServiceFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = service !== null;
  const isDuplicating = duplicateSource !== null && duplicateSource !== undefined;

  const [form, setForm] = useState<ServiceFormState>(emptyForm('', agencyId));
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      categoriesApi.list({ per_page: 100 }).then((r) => setCategories(r.data)).catch(() => {});
      agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
      const source = duplicateSource ?? service;
      setForm(
        source
          ? {
              name: source.name,
              category_id: source.category_id,
              agency_id: source.agency_id,
              price: source.price,
              description: source.description ?? '',
              cover_image: source.cover_image,
              presentation_video: source.presentation_video ?? '',
            }
          : emptyForm('', agencyId ?? '')
      );
      setFormError(null);
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, service, duplicateSource, agencyId]);

  function update<K extends keyof ServiceFormState>(field: K, value: ServiceFormState[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCoverUpload(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    try {
      const result = await uploadsApi.upload(file);
      update('cover_image', result.url);
    } catch (error) {
      showToast(extractErrorMessage(error, t('services.uploadFailed')), 'error');
    } finally {
      setIsUploading(false);
    }
  }

  function buildPayload(): ServicePayload {
    return {
      name: form.name.trim(),
      category_id: form.category_id,
      agency_id: form.agency_id,
      price: form.price,
      description: form.description.trim() || null,
      cover_image: form.cover_image,
      presentation_video: form.presentation_video.trim() || null,
    };
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload();
      const saved = isEditing
        ? await servicesApi.update(service.id, payload)
        : await servicesApi.create(payload);

      showToast(isEditing ? t('services.updated') : t('services.saved'), 'success');
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('services.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('services.editTitle') : isDuplicating ? t('services.duplicateTitle') : t('services.createTitle')}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('services.name')}
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder={t('services.namePlaceholder')}
          />
          <Select
            label={t('services.category')}
            required
            value={form.category_id}
            onChange={(e) => update('category_id', e.target.value)}
            error={fieldErrors.category_id}
          >
            <option value="">{t('services.selectCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </div>

        <Select
          label={t('services.agency')}
          required
          value={form.agency_id}
          onChange={(e) => update('agency_id', e.target.value)}
          error={fieldErrors.agency_id}
        >
          <option value="">{t('services.selectAgency')}</option>
          {agencies.map((agency) => (
            <option key={agency.id} value={agency.id}>
              {agency.name}
            </option>
          ))}
        </Select>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('services.price')}
            required
            type="number"
            step="0.01"
            min="0"
            value={form.price}
            onChange={(e) => update('price', e.target.value)}
            error={fieldErrors.price}
            placeholder="0.00"
          />
          <Input
            label={t('services.presentationVideo')}
            value={form.presentation_video}
            onChange={(e) => update('presentation_video', e.target.value)}
            error={fieldErrors.presentation_video}
            placeholder="https://..."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('services.description')}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            placeholder={t('services.descriptionPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
          {fieldErrors.description && (
            <p className="text-sm text-error-500">{fieldErrors.description}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('services.coverImage')}
          </label>
          {form.cover_image && (
            <div className="relative w-40 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <img src={form.cover_image} alt={form.name} className="h-24 w-full object-cover" />
              <button
                type="button"
                onClick={() => update('cover_image', null)}
                className="absolute right-1 top-1 rounded-lg bg-gray-900/70 p-1 text-white hover:bg-gray-900"
                title={t('services.removeCover')}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-4 text-sm text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
            {isUploading ? t('services.uploading') : t('services.uploadCover')}
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
