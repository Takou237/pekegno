import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { servicesApi } from '@/api/services.api';
import { categoriesApi } from '@/api/categories.api';
import { agenciesApi } from '@/api/agencies.api';
import { departmentsApi } from '@/api/departments.api';
import { formationsApi } from '@/api/formations.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { Checkbox } from '@/components/ui/Checkbox';
import type { Category } from '@/types/category';
import type { Agency } from '@/types/agency';
import type { Department } from '@/types/department';
import type { Service, ServicePayload, FormationType } from '@/types/service';

type AttachmentType = 'agency' | 'department';

interface ServiceFormState {
  name: string;
  category_id: string;
  attachmentType: AttachmentType;
  agency_id: string;
  department_id: string;
  price: string;
  description: string;
  cover_image: string | null;
  presentation_video: string;
  is_formation: boolean;
  formationType: FormationType;
  duration: string;
  conditions: string;
  deposit_amount: string;
  installments_count: string;
  online_payment: boolean;
}

function emptyForm(categoryId: string): ServiceFormState {
  return {
    name: '',
    category_id: categoryId,
    attachmentType: 'agency',
    agency_id: '',
    department_id: '',
    price: '',
    description: '',
    cover_image: null,
    presentation_video: '',
    is_formation: false,
    formationType: 'presentiel',
    duration: '',
    conditions: '',
    deposit_amount: '',
    installments_count: '',
    online_payment: false,
  };
}

interface ServiceFormModalProps {
  isOpen: boolean;
  service: Service | null; // null = création
  onClose: () => void;
  onSaved: (service: Service) => void;
}

export function ServiceFormModal({ isOpen, service, onClose, onSaved }: ServiceFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = service !== null;

  const [form, setForm] = useState<ServiceFormState>(emptyForm(''));
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      categoriesApi.list({ per_page: 100 }).then((r) => setCategories(r.data)).catch(() => {});
      agenciesApi.list({ per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
      departmentsApi.list({ per_page: 100 }).then((r) => setDepartments(r.data)).catch(() => {});
      const firstCategory = categories[0]?.id ?? '';
      setForm(
        service
          ? {
              name: service.name,
              category_id: service.category_id,
              attachmentType: service.department_id ? 'department' : 'agency',
              agency_id: service.agency_id ?? '',
              department_id: service.department_id ?? '',
              price: service.price,
              description: service.description ?? '',
              cover_image: service.cover_image,
              presentation_video: service.presentation_video ?? '',
              is_formation: service.is_formation,
              formationType: service.formation?.type ?? 'presentiel',
              duration: service.formation?.duration ?? '',
              conditions: service.formation?.conditions ?? '',
              deposit_amount: service.formation?.deposit_amount ?? '',
              installments_count: service.formation?.installments_count?.toString() ?? '',
              online_payment: service.formation?.online_payment ?? false,
            }
          : emptyForm(firstCategory)
      );
      setFormError(null);
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, service]);

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
    const payload: ServicePayload = {
      name: form.name.trim(),
      category_id: form.category_id,
      price: form.price,
      description: form.description.trim() || null,
      cover_image: form.cover_image,
      presentation_video: form.presentation_video.trim() || null,
      agency_id: form.attachmentType === 'agency' ? form.agency_id || null : null,
      department_id: form.attachmentType === 'department' ? form.department_id || null : null,
      formation: form.is_formation
        ? {
            type: form.formationType,
            duration: form.duration.trim() || null,
            conditions: form.conditions.trim() || null,
            deposit_amount: form.deposit_amount ? Number(form.deposit_amount) : null,
            installments_count: form.installments_count
              ? Number(form.installments_count)
              : null,
            online_payment: form.online_payment,
          }
        : null,
    };
    return payload;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = buildPayload();
      let saved: Service;

      if (isEditing) {
        saved = await servicesApi.update(service.id, payload);
        if (service.is_formation && !form.is_formation) {
          await formationsApi.remove(service.id);
        }
      } else {
        saved = await servicesApi.create(payload);
      }

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

  const filteredDepartments =
    form.attachmentType === 'department'
      ? departments.filter((dept) => dept.agency_id === form.agency_id)
      : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('services.editTitle') : t('services.createTitle')}
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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('services.attachedTo')} <span className="text-error-500">*</span>
            </label>
            <div className="flex gap-2">
              {(['agency', 'department'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => update('attachmentType', type)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    form.attachmentType === type
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  {type === 'agency' ? t('services.anAgency') : t('services.aDepartment')}
                </button>
              ))}
            </div>
          </div>
          <Select
            label={t('services.agency')}
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
        </div>

        {form.attachmentType === 'department' && (
          <Select
            label={t('services.department')}
            required
            value={form.department_id}
            onChange={(e) => update('department_id', e.target.value)}
            error={fieldErrors.department_id}
          >
            <option value="">{t('services.selectDepartment')}</option>
            {filteredDepartments.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </Select>
        )}

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

        <Checkbox
          label={t('services.isFormation')}
          checked={form.is_formation}
          onChange={(e) => update('is_formation', e.target.checked)}
        />

        {form.is_formation && (
          <div className="flex flex-col gap-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label={t('formations.type')}
                value={form.formationType}
                onChange={(e) => update('formationType', e.target.value as FormationType)}
              >
                <option value="presentiel">{t('formations.presentiel')}</option>
                <option value="distanciel">{t('formations.distanciel')}</option>
              </Select>
              <Input
                label={t('formations.duration')}
                value={form.duration}
                onChange={(e) => update('duration', e.target.value)}
                error={fieldErrors.duration}
                placeholder={t('formations.durationPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label={t('formations.depositAmount')}
                type="number"
                step="0.01"
                min="0"
                value={form.deposit_amount}
                onChange={(e) => update('deposit_amount', e.target.value)}
                error={fieldErrors.deposit_amount}
                placeholder="0.00"
              />
              <Input
                label={t('formations.installmentsCount')}
                type="number"
                min="1"
                value={form.installments_count}
                onChange={(e) => update('installments_count', e.target.value)}
                error={fieldErrors.installments_count}
                placeholder="1"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('formations.conditions')}
              </label>
              <textarea
                value={form.conditions}
                onChange={(e) => update('conditions', e.target.value)}
                rows={2}
                placeholder={t('formations.conditionsPlaceholder')}
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
              />
            </div>
            <Checkbox
              label={t('formations.onlinePayment')}
              checked={form.online_payment}
              onChange={(e) => update('online_payment', e.target.checked)}
            />
          </div>
        )}

        <div className="mt-2 flex justify-end gap-3">
          <div className="w-32">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t('common.cancel')}
            </Button>
          </div>
          <div className="w-40">
            <Button type="submit" isLoading={isSubmitting}>
              {isEditing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
