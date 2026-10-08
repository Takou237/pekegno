import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Pencil, Percent, Plus, Tag, Trash2, UserPlus, X } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import { canCreatePrestation, canManagePackages } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ClientPicker, CommercialPicker } from '@/components/agencyDept/Pickers';
import {
  ACTION_TYPES,
  FREQUENCIES,
  type AgencyCategory,
  type AgencyPackage,
  type BillingPeriod,
  type PackageItem,
  type PackageRecommendation,
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

/** Packages Agency : cartes façon flyer, groupées par catégorie (§6.2). */
export default function AgencyDeptPackagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { departmentId, agencyId, basePath } = useAgencyDept();
  const canManage = canManagePackages(user);

  const [packages, setPackages] = useState<AgencyPackage[]>([]);
  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AgencyPackage | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<PackageForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [newCategory, setNewCategory] = useState('');
  const [promoTarget, setPromoTarget] = useState<AgencyPackage | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<AgencyPackage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgencyPackage | null>(null);

  const load = useCallback(() => {
    if (!departmentId) return;
    setLoading(true);
    Promise.all([
      agencyDeptApi.packages({ department_id: departmentId }),
      agencyDeptApi.categories({ kind: 'package', department_id: departmentId }),
    ])
      .then(([p, c]) => {
        setPackages(p);
        setCategories(c);
      })
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))))
      .finally(() => setLoading(false));
  }, [departmentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const groups = new Map<string, { name: string; items: AgencyPackage[] }>();
    for (const p of packages) {
      const key = p.category_id ?? 'none';
      if (!groups.has(key)) groups.set(key, { name: p.category?.name ?? t('agencyDept.packages.uncategorized'), items: [] });
      groups.get(key)!.items.push(p);
    }
    return [...groups.values()];
  }, [packages, t]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(p: AgencyPackage) {
    setEditing(p);
    setForm({
      name: p.name,
      tagline: p.tagline ?? '',
      category_id: p.category_id ?? '',
      description: p.description ?? '',
      prerequisites: p.prerequisites ?? '',
      price_per_month: String(Number(p.price_per_month)),
      original_price: p.original_price ? String(Number(p.original_price)) : '',
      price_is_starting_from: p.price_is_starting_from,
      billing_period: p.billing_period,
      min_duration_months: p.min_duration_months ? String(p.min_duration_months) : '',
      is_active: p.is_active,
      items: p.items.map((i) => ({ label: i.label, quantity: i.quantity, frequency: i.frequency, unit: i.unit, action_type: i.action_type, service_id: i.service_id })),
      recommendations: p.recommendations.map((r) => ({ label: r.label, quantity: r.quantity, client_team_role_id: r.client_team_role_id })),
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!agencyId) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      agency_id: agencyId,
      department_id: departmentId,
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
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
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

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deletePackage(deleteTarget.id);
      showToast(t('agencyDept.deleted'), 'success');
      setDeleteTarget(null);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.packages')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.packages.subtitle')}</p>
        </div>
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('agencyDept.packages.new')}
          </Button>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <SkeletonCards />
      ) : packages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
          {t('agencyDept.packages.empty')}
        </p>
      ) : (
        grouped.map((group) => (
          <section key={group.name} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <Tag className="h-4 w-4" /> {group.name}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {group.items.map((p) => (
                <PackageCard
                  key={p.id}
                  pkg={p}
                  canManage={canManage}
                  canSubscribe={canCreatePrestation(user) && p.is_active}
                  onEdit={() => openEdit(p)}
                  onPromo={() => setPromoTarget(p)}
                  onSubscribe={() => setSubscribeTarget(p)}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('agencyDept.packages.edit') : t('agencyDept.packages.new')} maxWidth="max-w-3xl">
        <form onSubmit={handleSave} className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto pr-1">
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('agencyDept.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label={t('agencyDept.packages.tagline')} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
            <div className="flex flex-col gap-1.5">
              <Select label={t('agencyDept.category')} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
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
            <Input label={t('agencyDept.packages.price')} type="number" min={0} required value={form.price_per_month} onChange={(e) => setForm({ ...form, price_per_month: e.target.value })} />
            <Input label={t('agencyDept.packages.originalPrice')} type="number" min={0} value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} />
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
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_70px_130px_100px_150px_auto]">
                <Input placeholder={t('agencyDept.packages.itemLabel')} value={item.label} onChange={(e) => updateList('items', i, { label: e.target.value })} />
                <Input placeholder="Qté" type="number" min={1} value={item.quantity ?? ''} onChange={(e) => updateList('items', i, { quantity: e.target.value ? Number(e.target.value) : null })} />
                <Select value={item.frequency ?? 'per_month'} onChange={(e) => updateList('items', i, { frequency: e.target.value as PackageItem['frequency'] })}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`agencyDept.frequency.${f}`)}</option>)}
                </Select>
                <Input placeholder={t('agencyDept.unit')} value={item.unit ?? ''} onChange={(e) => updateList('items', i, { unit: e.target.value })} />
                <Select value={item.action_type ?? 'other'} onChange={(e) => updateList('items', i, { action_type: e.target.value as PackageItem['action_type'] })}>
                  {ACTION_TYPES.map((a) => <option key={a} value={a}>{t(`agencyDept.actionType.${a}`)}</option>)}
                </Select>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFromList('items', i)}><X className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setForm({ ...form, items: [...form.items, { label: '', quantity: 1, frequency: 'per_month', action_type: 'other' }] })}>
              <Plus className="h-4 w-4" /> {t('agencyDept.packages.addItem')}
            </Button>
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

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={saving}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {promoTarget && <PromotionModal pkg={promoTarget} onClose={() => setPromoTarget(null)} onSaved={load} />}

      {subscribeTarget && (
        <SubscribeModal
          pkg={subscribeTarget}
          departmentId={departmentId}
          onClose={() => setSubscribeTarget(null)}
          onDone={(prestationId) => {
            setSubscribeTarget(null);
            navigate(`${basePath}/prestations/${prestationId}`);
          }}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('agencyDept.packages.delete')}
        message={t('agencyDept.packages.deleteConfirm', { name: deleteTarget?.name ?? '' })}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );

  function updateList<K extends 'items' | 'recommendations'>(key: K, index: number, patch: Partial<PackageForm[K][number]>) {
    setForm((f) => ({ ...f, [key]: f[key].map((row, i) => (i === index ? { ...row, ...patch } : row)) }));
  }

  function removeFromList(key: 'items' | 'recommendations', index: number) {
    setForm((f) => ({ ...f, [key]: f[key].filter((_, i) => i !== index) }));
  }
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

function PackageCard({
  pkg,
  canManage,
  canSubscribe,
  onEdit,
  onPromo,
  onSubscribe,
  onDelete,
}: {
  pkg: AgencyPackage;
  canManage: boolean;
  canSubscribe: boolean;
  onEdit: () => void;
  onPromo: () => void;
  onSubscribe: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const price = Number(pkg.price_per_month);
  const hasPromo = pkg.effective_price < price;
  const original = pkg.original_price ? Number(pkg.original_price) : null;

  return (
    <div className={`flex flex-col rounded-2xl border-2 bg-white p-5 dark:bg-gray-900 ${pkg.is_active ? 'border-amber-300/70 dark:border-amber-500/40' : 'border-gray-100 opacity-60 dark:border-gray-800'}`}>
      <div className="text-center">
        <h3 className="text-lg font-bold uppercase text-gray-900 dark:text-white">{pkg.name}</h3>
        {pkg.tagline && <p className="mt-1 text-sm font-medium uppercase text-gray-500 dark:text-gray-400">{pkg.tagline}</p>}
        {hasPromo && <span className="mt-2 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{t('agencyDept.packages.promoActive')}</span>}
      </div>

      <ul className="mt-4 flex flex-1 flex-col gap-2 text-sm text-gray-600 dark:text-gray-300">
        {pkg.items.map((item) => (
          <li key={item.id ?? item.label} className="flex gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>

      {pkg.recommendations.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3 text-xs dark:bg-amber-500/10">
          <p className="font-semibold uppercase text-amber-800 dark:text-amber-300">{t('agencyDept.packages.recommendations')}</p>
          {pkg.recommendations.map((r) => (
            <p key={r.id ?? r.label} className="uppercase text-amber-900 dark:text-amber-200">
              {String(r.quantity ?? 1).padStart(2, '0')} {r.label}
            </p>
          ))}
        </div>
      )}

      {pkg.prerequisites && <p className="mt-3 text-xs text-gray-500 dark:text-gray-400"><strong>{t('agencyDept.packages.prerequisites')} :</strong> {pkg.prerequisites}</p>}

      <div className="mt-4 text-center">
        {(original || hasPromo) && (
          <p className="text-sm text-gray-400 line-through">{formatCurrency(hasPromo ? price : original)}</p>
        )}
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {pkg.price_is_starting_from && <span className="mr-1 text-xs font-normal text-gray-500">{t('agencyDept.packages.from')}</span>}
          {formatCurrency(pkg.effective_price)}
          <span className="text-xs font-normal text-gray-500"> / {t(`agencyDept.billingPeriod.${pkg.billing_period}`)}</span>
        </p>
        {pkg.contracts_count !== undefined && (
          <p className="text-xs text-gray-400">{t('agencyDept.packages.contractsCount', { count: pkg.contracts_count })}</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {canSubscribe && (
          <Button size="sm" onClick={onSubscribe}><UserPlus className="h-4 w-4" /> {t('agencyDept.packages.subscribe')}</Button>
        )}
        {canManage && (
          <>
            <Button size="sm" variant="outline" onClick={onEdit} title={t('common.edit')}><Pencil className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={onPromo} title={t('agencyDept.packages.promotions')}><Percent className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={onDelete} title={t('common.delete')}><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>
    </div>
  );
}

function PromotionModal({ pkg, onClose, onSaved }: { pkg: AgencyPackage; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [type, setType] = useState<'amount' | 'percent'>('percent');
  const [value, setValue] = useState('');
  const [start, setStart] = useState(todayLocal());
  const [end, setEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState(pkg.promotions);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await agencyDeptApi.addPromotion(pkg.id, {
        type,
        promo_price: type === 'amount' ? Number(value) : undefined,
        discount_percent: type === 'percent' ? Number(value) : undefined,
        start_date: start,
        end_date: end,
      });
      const fresh = await agencyDeptApi.package(pkg.id);
      setPromotions(fresh.promotions);
      setValue('');
      onSaved();
      showToast(t('agencyDept.saved'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await agencyDeptApi.deletePromotion(pkg.id, id);
      setPromotions((p) => p.filter((x) => x.id !== id));
      onSaved();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`${t('agencyDept.packages.promotions')} — ${pkg.name}`} maxWidth="max-w-lg">
      <div className="flex flex-col gap-4">
        {promotions.length > 0 && (
          <ul className="flex flex-col gap-2 text-sm">
            {promotions.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800">
                <span className="text-gray-700 dark:text-gray-200">
                  {p.type === 'percent' ? `-${Number(p.discount_percent)} %` : formatCurrency(p.promo_price)} · {p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}
                </span>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2">
          <Select label={t('agencyDept.packages.promoType')} value={type} onChange={(e) => setType(e.target.value as 'amount' | 'percent')}>
            <option value="percent">{t('agencyDept.packages.promoPercent')}</option>
            <option value="amount">{t('agencyDept.packages.promoAmount')}</option>
          </Select>
          <Input label={type === 'percent' ? '%' : t('agencyDept.packages.price')} type="number" min={0} required value={value} onChange={(e) => setValue(e.target.value)} />
          <Input label={t('agencyDept.startDate')} type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label={t('agencyDept.endDate')} type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />
          <div className="flex justify-end gap-3 sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.close')}</Button>
            <Button type="submit" isLoading={saving}>{t('common.add')}</Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function SubscribeModal({
  pkg,
  departmentId,
  onClose,
  onDone,
}: {
  pkg: AgencyPackage;
  departmentId?: string;
  onClose: () => void;
  onDone: (prestationId: string) => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [clientId, setClientId] = useState('');
  const [commercialId, setCommercialId] = useState('');
  const [start, setStart] = useState(todayLocal());
  const [periods, setPeriods] = useState('1');
  const [advance, setAdvance] = useState('');
  const [paymentType, setPaymentType] = useState<'cash' | 'om' | 'momo'>('cash');
  const [autoRenew, setAutoRenew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = pkg.effective_price * Number(periods || 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await agencyDeptApi.subscribe(pkg.id, {
        client_id: clientId,
        commercial_id: commercialId || undefined,
        department_id: departmentId,
        start_date: start,
        periods: Number(periods),
        auto_renew: autoRenew,
        advance: advance ? Number(advance) : undefined,
        payment_type: advance ? paymentType : undefined,
      });
      showToast(t('agencyDept.packages.subscribed', { contract: res.contract.number }), 'success');
      onDone(res.prestation.id);
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`${t('agencyDept.packages.subscribe')} — ${pkg.name}`} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.packages.subscribeHint')}</p>
        <ClientPicker value={clientId} onChange={setClientId} />
        <CommercialPicker value={commercialId} onChange={setCommercialId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.startDate')} type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          <Input label={t('agencyDept.packages.periods', { period: t(`agencyDept.billingPeriod.${pkg.billing_period}`) })} type="number" min={1} max={60} required value={periods} onChange={(e) => setPeriods(e.target.value)} />
          <Input label={t('agencyDept.packages.advance')} type="number" min={0} value={advance} onChange={(e) => setAdvance(e.target.value)} />
          <Select label={t('agencyDept.packages.paymentType')} value={paymentType} onChange={(e) => setPaymentType(e.target.value as typeof paymentType)} disabled={!advance}>
            <option value="cash">Cash</option>
            <option value="om">Orange Money</option>
            <option value="momo">MTN MoMo</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} />
          {t('agencyDept.packages.autoRenew')}
        </label>
        <p className="text-right text-sm font-semibold text-gray-900 dark:text-white">{t('agencyDept.total')} : {formatCurrency(total)}</p>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving} disabled={!clientId}>{t('common.confirm')}</Button>
        </div>
      </form>
    </Modal>
  );
}
