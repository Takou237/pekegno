import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { agenciesApi } from '@/api/agencies.api';
import { countriesApi } from '@/api/countries.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { CountryAutocomplete } from '@/components/ui/CountryAutocomplete';
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
      setFormError(null);
      setFieldErrors({});
    }
  }, [isOpen, agency, defaultCountry]);

  function update<K extends keyof AgencyPayload>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Résout l'id d'un pays à partir de son nom. Retourne null si introuvable
  // (le backend conservera l'ancien pays, seul le libellé changera).
  async function resolveCountryId(name: string): Promise<string | null> {
    const query = name.trim();
    if (!query) return null;
    try {
      const { data } = await countriesApi.list({ search: query, per_page: 1 });
      return data[0]?.id ?? null;
    } catch {
      return null;
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    // Une agence exerce par défaut les deux lignes de métier (Agency + Academy) :
    // le choix se fait à l'intérieur de l'agence, pas à la création.
    const payload: AgencyPayload = { ...form };

    // À la création : pays du contexte. À la modification : on résout l'id du pays
    // à partir du nom saisi, pour que le changement de pays soit réellement
    // appliqué (stats, bilan, etc. filtrent via agencies.country_id).
    // Si le nom ne correspond à aucun pays connu, on n'envoie pas country_id :
    // l'ancien pays est conservé plutôt qu'écrasé par null.
    if (!isEditing) {
      const countryId = defaultCountry?.id ?? (await resolveCountryId(form.country));
      if (countryId) payload.country_id = countryId;
    } else {
      const countryId = await resolveCountryId(form.country);
      if (countryId) payload.country_id = countryId;
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
          <CountryAutocomplete
            label={t('agencies.country')}
            required
            value={form.country}
            onChange={(value) => update('country', value)}
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
