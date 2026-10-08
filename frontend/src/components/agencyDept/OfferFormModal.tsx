import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { agenciesApi } from '@/api/agencies.api';
import { departmentsApi } from '@/api/departments.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import type { AgencyCategory, PrestationOffer } from '@/types/agencyDepartment';
import type { Agency } from '@/types/agency';
import type { Department } from '@/types/department';

/**
 * Création / modification d'une offre de prestation (« Campagne Facebook ») :
 * fiche simple nom + catégorie à laquelle les clients souscrivent.
 */
export function OfferFormModal({
  isOpen,
  onClose,
  onSaved,
  offer,
  agencyId,
  countryId,
  departmentId,
  canManage = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (o: PrestationOffer) => void;
  offer?: PrestationOffer | null;
  /** Agence fournie par la page département : pas de sélecteur d'agence. */
  agencyId?: string;
  /** Vue pays : l'agence est choisie dans une liste. */
  countryId?: string;
  departmentId?: string;
  /** Désactive la création d'une catégorie à la volée (droits lecture seule). */
  canManage?: boolean;
}) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    name: '',
    agency_id: '',
    department_id: '',
    category_id: '',
    description: '',
    is_active: true,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  const needsAgencyChoice = !agencyId;

  useEffect(() => {
    if (!isOpen) return;
    agencyDeptApi
      .categories({ kind: 'prestation', department_id: departmentId, country_id: countryId })
      .then(setCategories)
      .catch(() => {});
    if (needsAgencyChoice) {
      agenciesApi.list({ country_id: countryId, per_page: 100 }).then((r) => setAgencies(r.data)).catch(() => {});
    }
    setError(null);
    setFieldErrors({});
    setForm({
      name: offer?.name ?? '',
      agency_id: offer?.agency_id ?? '',
      department_id: offer?.department_id ?? '',
      category_id: offer?.category_id ?? '',
      description: offer?.description ?? '',
      is_active: offer?.is_active ?? true,
    });
  }, [isOpen, offer, departmentId, countryId, needsAgencyChoice]);

  // Hors département (vue pays), l'offre doit être rattachée à un département
  // pour pouvoir ensuite ouvrir ses souscriptions.
  useEffect(() => {
    if (!departmentId && form.agency_id) {
      departmentsApi
        .list({ agency_id: form.agency_id, per_page: 100 })
        .then((r) => setDepartments(r.data))
        .catch(() => setDepartments([]));
    }
  }, [departmentId, form.agency_id]);

  async function addCategory() {
    if (!newCategory.trim()) return;
    try {
      const c = await agencyDeptApi.createCategory({ kind: 'prestation', name: newCategory.trim(), department_id: departmentId ?? null });
      setCategories((list) => [...list, c]);
      setForm((f) => ({ ...f, category_id: c.id }));
      setNewCategory('');
    } catch (e) {
      setError(extractErrorMessage(e, t('common.error')));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const payload = {
      agency_id: agencyId ?? form.agency_id,
      department_id: (departmentId ?? form.department_id) || null,
      category_id: form.category_id || null,
      name: form.name,
      description: form.description || null,
      is_active: form.is_active,
    };
    try {
      const saved = offer
        ? await agencyDeptApi.updateOffer(offer.id, payload)
        : await agencyDeptApi.createOffer(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
      setFieldErrors(extractFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={offer ? t('agencyDept.offers.edit') : t('agencyDept.offers.new')}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.name')} required error={fieldErrors.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          {!offer && needsAgencyChoice && (
            <Select label={t('agencyDept.agency')} required error={fieldErrors.agency_id} value={form.agency_id} onChange={(e) => setForm({ ...form, agency_id: e.target.value })}>
              <option value="">{t('services.selectAgency')}</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          )}
          {!departmentId && (
            <Select label={t('agencyDept.department')} required={departments.length > 0} error={fieldErrors.department_id} value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
              <option value="">{t('common.noDepartment')}</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
          <div className="flex flex-col gap-1.5">
            <Select label={t('agencyDept.category')} error={fieldErrors.category_id} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {canManage && (
              <div className="flex gap-2">
                <Input placeholder={t('agencyDept.newCategory')} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={addCategory}><Plus className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <div className="flex items-end pb-2 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              {t('common.active')}
            </label>
          </div>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('agencyDept.description')}
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-gray-700 dark:text-white"
          />
        </label>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
