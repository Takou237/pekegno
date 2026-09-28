import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { countriesApi } from '@/api/countries.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { Agency, AgencyPayload } from '@/types/agency';
import type { CountryStat } from '@/types/stats';

const emptyForm: AgencyPayload = {
  name: '',
  country: '',
  country_id: '',
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

export function AgencyFormModal({ isOpen, agency, defaultCountry, onClose, onSaved }: AgencyFormModalProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const isEditing = agency !== null;

  const [form, setForm] = useState<AgencyPayload>(emptyForm);
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
              country_id: agency.country_id ?? '',
              city: agency.city ?? '',
              address: agency.address ?? '',
              phone: agency.phone ?? '',
              email: agency.email ?? '',
            }
          : {
              ...emptyForm,
              country: defaultCountry?.name ?? '',
              country_id: defaultCountry?.id ?? '',
            }
      );
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, agency, defaultCountry]);

  function update<K extends keyof AgencyPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Pays de l'organisation (table countries) : l'agence est rattachée par
  // country_id. L'ancien champ texte (liste mondiale + recherche par nom)
  // pouvait ne rien trouver et le changement de pays échouait en silence (T3).
  const [countries, setCountries] = useState<CountryStat[]>([]);
  useEffect(() => {
    if (!isOpen) return;
    countriesApi.list({ per_page: 100 }).then((r) => setCountries(r.data)).catch(() => {});
  }, [isOpen]);

  function selectCountry(countryId: string) {
    const country = countries.find((c) => c.id === countryId);
    setForm((prev) => ({ ...prev, country_id: countryId, country: country?.name ?? prev.country }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    // Une agence exerce par défaut les deux lignes de métier (Agency + Academy) :
    // le choix se fait à l'intérieur de l'agence, pas à la création.
    const payload: AgencyPayload = { ...form };

    if (!payload.country_id) {
      setFieldErrors({ country_id: t('agencies.countryRequired') });
      setIsSubmitting(false);
      return;
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
          <Select
            label={t('agencies.country')}
            required
            value={form.country_id ?? ''}
            onChange={(e) => selectCountry(e.target.value)}
            error={fieldErrors.country_id ?? fieldErrors.country}
          >
            <option value="" disabled>{t('agencies.selectCountry')}</option>
            {/* Pays actuel absent de la liste (inactif, hors périmètre) : on le garde affiché. */}
            {form.country_id && !countries.some((c) => c.id === form.country_id) && (
              <option value={form.country_id}>{form.country}</option>
            )}
            {countries.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
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
