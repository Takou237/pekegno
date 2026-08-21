import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, GraduationCap } from 'lucide-react';
import { agenciesApi } from '@/api/agencies.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Agency, AgencyPayload } from '@/types/agency';

const emptyForm: AgencyPayload = {
  name: '',
  country: '',
  city: '',
  address: '',
  phone: '',
  email: '',
};

interface AgencyFormModalProps {
  isOpen: boolean;
  agency: Agency | null; // null = création
  defaultCountry?: { id: string; name: string } | null;
  onClose: () => void;
  onSaved: (agency: Agency) => void;
}

function activeLines(agency: Agency | null): { agency: boolean; academy: boolean } {
  if (agency?.activities && agency.activities.length > 0) {
    return {
      agency: agency.activities.some((a) => a.type === 'agency' && a.is_active),
      academy: agency.activities.some((a) => a.type === 'academy' && a.is_active),
    };
  }

  // Fallback sur le type legacy en l'absence d'activités.
  return {
    agency: agency?.type !== 'academy',
    academy: agency?.type === 'academy' || agency?.type === 'mixed',
  };
}

export function AgencyFormModal({ isOpen, agency, defaultCountry, onClose, onSaved }: AgencyFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = agency !== null;

  const [form, setForm] = useState<AgencyPayload>(emptyForm);
  const [lines, setLines] = useState({ agency: true, academy: true });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm(
        agency
          ? {
              name: agency.name,
              country: agency.country,
              city: agency.city ?? '',
              address: agency.address ?? '',
              phone: agency.phone ?? '',
              email: agency.email ?? '',
            }
          : {
              ...emptyForm,
              country: defaultCountry?.name ?? '',
            }
      );
      setLines(activeLines(agency));
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, agency, defaultCountry]);

  function update<K extends keyof AgencyPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleLine(type: 'agency' | 'academy') {
    setLines((prev) => ({ ...prev, [type]: !prev[type] }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload: AgencyPayload = {
      ...form,
      activities: [
        { type: 'agency', is_active: lines.agency },
        { type: 'academy', is_active: lines.academy },
      ],
    };

    if (!isEditing) {
      payload.country_id = defaultCountry?.id ?? null;
    }

    try {
      const saved = isEditing
        ? await agenciesApi.update(agency.id, payload)
        : await agenciesApi.create(payload);

      showToast(
        isEditing ? t('agencies.updated') : t('agencies.saved'),
        'success'
      );
      onSaved(saved);
      onClose();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('agencies.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? t('agencies.editTitle') : t('agencies.createTitle')}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError && <Alert variant="error">{formError}</Alert>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('agencies.name')}
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            error={fieldErrors.name}
            placeholder={t('agencies.namePlaceholder')}
          />
          <Input
            label={t('agencies.country')}
            required
            value={form.country}
            onChange={(e) => update('country', e.target.value)}
            error={fieldErrors.country}
            placeholder={t('agencies.countryPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('agencies.city')}
            value={form.city}
            onChange={(e) => update('city', e.target.value)}
            error={fieldErrors.city}
            placeholder={t('agencies.cityPlaceholder')}
          />
          <Input
            label={t('agencies.address')}
            value={form.address}
            onChange={(e) => update('address', e.target.value)}
            error={fieldErrors.address}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('auth.phone')}
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            error={fieldErrors.phone}
            placeholder={t('agencies.phonePlaceholder')}
          />
          <Input
            label={t('auth.email')}
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            error={fieldErrors.email}
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('agencies.businessLines')}
          </p>
          <p className="mb-3 text-xs text-gray-400">{t('agencies.businessLinesHint')}</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => toggleLine('agency')}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                lines.agency
                  ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  lines.agency
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}
              >
                <Briefcase className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {t('agencies.lineAgency')}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t('agencies.lineAgencyDesc')}
                </span>
              </span>
              <input
                type="checkbox"
                className="ml-auto h-4 w-4 accent-brand-600"
                checked={lines.agency}
                onChange={() => toggleLine('agency')}
              />
            </button>

            <button
              type="button"
              onClick={() => toggleLine('academy')}
              className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                lines.academy
                  ? 'border-brand-300 bg-brand-50 dark:border-brand-500/40 dark:bg-brand-500/10'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900'
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  lines.academy
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-100 text-gray-400 dark:bg-gray-800'
                }`}
              >
                <GraduationCap className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                  {t('agencies.lineAcademy')}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {t('agencies.lineAcademyDesc')}
                </span>
              </span>
              <input
                type="checkbox"
                className="ml-auto h-4 w-4 accent-brand-600"
                checked={lines.academy}
                onChange={() => toggleLine('academy')}
              />
            </button>
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
