import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { countriesApi } from '@/api/countries.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { CountryDeployPicker } from '@/components/countries/CountryDeployPicker';
import type { CountryStat } from '@/types/stats';
import {
  ACTION_TYPES,
  FREQUENCIES,
  type AgencyCategory,
  type AgencyPackage,
  type BillingPeriod,
  type PackageItem,
  type PackagePayload,
  type PackageRecommendation,
  type PrestationOffer,
} from '@/types/agencyDepartment';

interface PackageForm {
  name: string;
  tagline: string;
  category_id: string;
  description: string;
  prerequisites: string;
  price_per_month: string;
  original_price: string;
  price_is_starting_from: boolean;
  billing_period: BillingPeriod;
  min_duration_months: string;
  is_active: boolean;
  items: PackageItem[];
  recommendations: PackageRecommendation[];
}

const emptyForm: PackageForm = {
  name: '',
  tagline: '',
  category_id: '',
  description: '',
  prerequisites: '',
  price_per_month: '',
  original_price: '',
  price_is_starting_from: false,
  billing_period: 'monthly',
  min_duration_months: '',
  is_active: true,
  items: [],
  recommendations: [],
};

/**
 * Création / modification d'un package Agency. À la création, le package est
 * dupliqué dans toutes les agences des pays cochés (CountryDeployPicker, comme
 * les services et les formations).
 */
export function PackageFormModal({
  isOpen,
  onClose,
  onSaved,
  editing,
  agencyId,
  countryId,
  departmentId,
  canManage = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: AgencyPackage | null;
  /** Agence de la page : créée en plus des agences des pays cochés. */
  agencyId?: string;
  /** Pays de la page, signalé « (pays actuel) » dans le sélecteur. */
  countryId?: string;
  departmentId?: string;
  /** Affiche l'ajout rapide de catégorie. */
  canManage?: boolean;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [availablePrestations, setAvailablePrestations] = useState<PrestationOffer[]>([]);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [targetCountryIds, setTargetCountryIds] = useState<string[]>([]);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [newCategory, setNewCategory] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setForm(
      editing
        ? {
            name: editing.name,
            tagline: editing.tagline ?? '',
            category_id: editing.category_id ?? '',
            description: editing.description ?? '',
            prerequisites: editing.prerequisites ?? '',
            price_per_month: String(Number(editing.price_per_month)),
            original_price: editing.original_price ? String(Number(editing.original_price)) : '',
            price_is_starting_from: editing.price_is_starting_from,
            billing_period: editing.billing_period,
            min_duration_months: editing.min_duration_months ? String(editing.min_duration_months) : '',
            is_active: editing.is_active,
            items: editing.items.map((i) => ({ label: i.label, quantity: i.quantity, frequency: i.frequency, unit: i.unit, action_type: i.action_type, service_id: i.service_id })),
            recommendations: editing.recommendations.map((r) => ({ label: r.label, quantity: r.quantity, client_team_role_id: r.client_team_role_id })),
          }
        : emptyForm
    );
    setNewCategory('');
    setFormError(null);
    setFieldErrors({});

    // Comme les services : à la création, le package est déployé par défaut
    // dans tous les pays actifs ; l'utilisateur décoche les autres.
    setTargetCountryIds([]);
    countriesApi
      .list({ per_page: 100 })
      .then((r) => {
        setCountries(r.data);
        if (!editing) setTargetCountryIds(r.data.filter((c) => c.is_active).map((c) => c.id));
      })
      .catch(() => {});

    agencyDeptApi
      .categories({ kind: 'package', department_id: departmentId, agency_id: agencyId, country_id: countryId })
      .then(setCategories)
      .catch(() => {});

    agencyDeptApi
      .offers({ department_id: departmentId, agency_id: agencyId, country_id: countryId, per_page: 100 })
      .then((r) => setAvailablePrestations(r.data))
      .catch(() => {});
  }, [isOpen, editing, agencyId, countryId, departmentId]);

  function updateList<K extends 'items' | 'recommendations'>(key: K, index: number, patch: Partial<PackageForm[K][number]>) {
    setForm((f) => ({ ...f, [key]: f[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  }

  function removeFromList(key: 'items' | 'recommendations', index: number) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
  }

  async function handleAddCategory() {
    if (!newCategory.trim()) return;
    try {
      const cat = await agencyDeptApi.createCategory({ kind: 'package', name: newCategory.trim(), department_id: departmentId ?? null });
      setCategories((c) => [...c, cat]);
      setForm((f) => ({ ...f, category_id: cat.id }));
      setNewCategory('');
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    setFieldErrors({});

    const payload: PackagePayload = {
      // Création : l'agence de la page (si fournie) + toutes les agences des pays cochés.
      agency_id: editing ? editing.agency_id : agencyId || undefined,
      ...(editing ? {} : { target_country_ids: targetCountryIds.length ? targetCountryIds : undefined }),
      department_id: editing ? editing.department_id ?? undefined : departmentId,
      category_id: form.category_id || null,
      name: form.name,
      tagline: form.tagline || null,
      description: form.description || null,
      prerequisites: form.prerequisites || null,
      price_per_month: Number(form.price_per_month),
      original_price: form.original_price ? Number(form.original_price) : null,
      price_is_starting_from: form.price_is_starting_from,
      billing_period: form.billing_period,
      min_duration_months: form.min_duration_months ? Number(form.min_duration_months) : null,
      is_active: form.is_active,
      items: form.items.filter((i) => i.label.trim()),
      recommendations: form.recommendations.filter((r) => r.label.trim()),
    };

    try {
      if (editing) {
        await agencyDeptApi.updatePackage(editing.id, payload);
      } else {
        await agencyDeptApi.createPackage(payload);
      }
      showToast(t('agencyDept.saved'), 'success');
      onSaved();
      onClose();
    } catch (err) {
      setFormError(extractErrorMessage(err, t('common.error')));
      setFieldErrors(extractFieldErrors(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editing ? t('agencyDept.packages.edit') : t('agencyDept.packages.new')} maxWidth="max-w-3xl">
      <form onSubmit={handleSave} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
        {formError && <Alert variant="error">{formError}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.name')} required error={fieldErrors.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('agencyDept.packages.tagline')} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <Select label={t('agencyDept.category')} error={fieldErrors.category_id} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            {canManage && (
              <div className="flex gap-2">
                <Input placeholder={t('agencyDept.newCategory')} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={handleAddCategory}><Plus className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          <Select label={t('agencyDept.packages.billingPeriod')} value={form.billing_period} onChange={(e) => setForm({ ...form, billing_period: e.target.value as BillingPeriod })}>
            {(['monthly', 'quarterly', 'yearly'] as BillingPeriod[]).map((b) => (
              <option key={b} value={b}>{t(`agencyDept.billingPeriod.${b}`)}</option>
            ))}
          </Select>
          <Input label={t('agencyDept.packages.price')} type="number" min={0} required error={fieldErrors.price_per_month} value={form.price_per_month} onChange={(e) => setForm({ ...form, price_per_month: e.target.value })} />
          <Input label={t('agencyDept.packages.minDuration')} type="number" min={1} value={form.min_duration_months} onChange={(e) => setForm({ ...form, min_duration_months: e.target.value })} />
          <div className="flex flex-col justify-end gap-2 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.price_is_starting_from} onChange={(e) => setForm({ ...form, price_is_starting_from: e.target.checked })} />
              {t('agencyDept.packages.startingFrom')}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              {t('common.active')}
            </label>
          </div>
        </div>

        <TextArea label={t('agencyDept.description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
        <TextArea label={t('agencyDept.packages.prerequisites')} value={form.prerequisites} onChange={(v) => setForm({ ...form, prerequisites: v })} />

        <fieldset className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{t('agencyDept.packages.items')}</legend>
          {form.items.map((item, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_70px_130px_150px_auto]">
              <Input placeholder={t('agencyDept.packages.itemLabel')} value={item.label} onChange={(e) => updateList('items', i, { label: e.target.value })} />
              <Input placeholder="Qté" type="number" min={1} value={item.quantity ?? ''} onChange={(e) => updateList('items', i, { quantity: e.target.value ? Number(e.target.value) : null })} />
              <Select value={item.frequency ?? 'per_month'} onChange={(e) => updateList('items', i, { frequency: e.target.value as PackageItem['frequency'] })}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`agencyDept.frequency.${f}`)}</option>)}
              </Select>
              <Select value={item.action_type ?? 'other'} onChange={(e) => updateList('items', i, { action_type: e.target.value as PackageItem['action_type'] })}>
                {ACTION_TYPES.map((a) => <option key={a} value={a}>{t(`agencyDept.actionType.${a}`)}</option>)}
              </Select>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFromList('items', i)}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { label: '', quantity: 1, frequency: 'per_month', action_type: 'other' }] })}>
              <Plus className="h-4 w-4" /> {t('agencyDept.packages.addItem')}
            </Button>
            <Select
              value=""
              aria-label={t('agencyDept.packages.addItemFromPrestation')}
              onChange={(e) => {
                const p = availablePrestations.find((x) => x.id === e.target.value);
                if (!p) return;
                setForm((f) => ({
                  ...f,
                  items: [...f.items, { label: p.name, quantity: 1, frequency: 'per_month', action_type: 'other' }],
                }));
              }}
            >
              <option value="">{t('agencyDept.packages.addItemFromPrestation')}</option>
              {availablePrestations.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <legend className="px-1 text-sm font-semibold text-gray-700 dark:text-gray-200">{t('agencyDept.packages.recommendations')}</legend>
          {form.recommendations.map((reco, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[80px_1fr_auto]">
              <Input type="number" min={1} value={reco.quantity ?? 1} onChange={(e) => updateList('recommendations', i, { quantity: Number(e.target.value) })} />
              <Input placeholder={t('agencyDept.packages.recoLabel')} value={reco.label} onChange={(e) => updateList('recommendations', i, { label: e.target.value })} />
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFromList('recommendations', i)}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, recommendations: [...form.recommendations, { label: '', quantity: 1 }] })}>
            <Plus className="h-4 w-4" /> {t('agencyDept.packages.addReco')}
          </Button>
        </fieldset>

        {!editing && (
          <CountryDeployPicker
            countries={countries}
            selectedIds={targetCountryIds}
            onChange={setTargetCountryIds}
            currentCountryId={countryId}
            hint={t('agencyDept.packages.deployHint')}
            error={fieldErrors.target_country_ids ?? fieldErrors.agency_id}
          />
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving}>{editing ? t('common.save') : t('common.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
      {label}
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-gray-700 dark:text-white"
      />
    </label>
  );
}
