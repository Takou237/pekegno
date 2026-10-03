import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { todayLocal } from '@/utils/date';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { ClientPicker, CommercialPicker } from './Pickers';
import type { AgencyCategory, Prestation } from '@/types/agencyDepartment';

/** Création / modification d'une prestation (catégorie, nom, période, client, budget, commercial). */
export function PrestationFormModal({
  isOpen,
  onClose,
  onSaved,
  prestation,
  agencyId,
  departmentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (p: Prestation) => void;
  prestation?: Prestation | null;
  agencyId?: string;
  departmentId?: string;
}) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [form, setForm] = useState({
    name: '',
    category_id: '',
    description: '',
    client_id: '',
    commercial_id: '',
    start_date: todayLocal(),
    end_date: '',
    budget: '',
    commission_type: '' as '' | 'percent' | 'fixed',
    commission_value: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    agencyDeptApi.categories({ kind: 'prestation', department_id: departmentId }).then(setCategories).catch(() => {});
    setError(null);
    setForm({
      name: prestation?.name ?? '',
      category_id: prestation?.category_id ?? '',
      description: prestation?.description ?? '',
      client_id: prestation?.client_id ?? '',
      commercial_id: prestation?.commercial_id ?? '',
      start_date: prestation?.start_date?.slice(0, 10) ?? todayLocal(),
      end_date: prestation?.end_date?.slice(0, 10) ?? '',
      budget: prestation ? String(Number(prestation.budget)) : '',
      commission_type: prestation?.commission_type ?? '',
      commission_value: prestation?.commission_value ? String(Number(prestation.commission_value)) : '',
    });
  }, [isOpen, prestation, departmentId]);

  const budgetLocked = !!prestation?.contract_id;

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
    const payload = {
      name: form.name,
      category_id: form.category_id || null,
      description: form.description || null,
      client_id: form.client_id,
      commercial_id: form.commercial_id || null,
      start_date: form.start_date,
      end_date: form.end_date,
      ...(budgetLocked ? {} : { budget: Number(form.budget) }),
      commission_type: prestation?.package_id ? undefined : form.commission_type || null,
      commission_value: prestation?.package_id ? undefined : form.commission_value ? Number(form.commission_value) : null,
    };
    try {
      const saved = prestation
        ? await agencyDeptApi.updatePrestation(prestation.id, payload)
        : await agencyDeptApi.createPrestation({ ...payload, agency_id: agencyId, department_id: departmentId });
      onSaved(saved);
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={prestation ? t('agencyDept.prestations.edit') : t('agencyDept.prestations.new')} maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.name')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="flex flex-col gap-1.5">
            <Select label={t('agencyDept.category')} value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <div className="flex gap-2">
              <Input placeholder={t('agencyDept.newCategory')} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              <Button type="button" variant="outline" size="sm" onClick={addCategory}>+</Button>
            </div>
          </div>
          {!prestation && <ClientPicker value={form.client_id} onChange={(id) => setForm({ ...form, client_id: id })} />}
          <CommercialPicker value={form.commercial_id} onChange={(id) => setForm({ ...form, commercial_id: id })} />
          <Input label={t('agencyDept.startDate')} type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label={t('agencyDept.endDate')} type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Input
            label={t('agencyDept.budget.total')}
            type="number"
            min={0}
            required
            disabled={budgetLocked}
            hint={budgetLocked ? t('agencyDept.prestations.budgetLocked') : undefined}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
        </div>
        {!prestation?.package_id && (
          <div className="grid gap-3 rounded-xl border border-gray-100 p-3 sm:grid-cols-2 dark:border-gray-800">
            <p className="text-xs text-gray-500 sm:col-span-2 dark:text-gray-400">{t('agencyDept.prestations.commissionHint')}</p>
            <Select label={t('agencyDept.prestations.commissionType')} value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value as typeof form.commission_type })}>
              <option value="">{t('agencyDept.prestations.noCommission')}</option>
              <option value="percent">%</option>
              <option value="fixed">{t('agencyDept.prestations.fixedAmount')}</option>
            </Select>
            <Input label={t('agencyDept.prestations.commissionValue')} type="number" min={0} disabled={!form.commission_type} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
          </div>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('agencyDept.description')}
          <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-gray-300 bg-transparent px-3 py-2 text-sm font-normal dark:border-gray-700 dark:text-white" />
        </label>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving} disabled={!prestation && !form.client_id}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
