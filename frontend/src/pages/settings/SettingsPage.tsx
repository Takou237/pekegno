import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { Save, Plus, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '@/api/settings.api';
import { accountingApi } from '@/api/accounting.api';
import { categoriesApi } from '@/api/categories.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import type { CommissionType } from '@/types/settings';
import type { AccountingCategory, AccountingType } from '@/types/accounting';
import type { Category } from '@/types/category';

type Tab = 'general' | 'accounting-cats' | 'service-cats';

interface SettingsForm {
  sales_points_per_sale: string;
  prospect_points_per_add: string;
  prospect_points_per_conversion: string;
  inactivity_period_days: string;
  inactivity_penalty_points: string;
  default_commission_type: CommissionType;
  default_commission_value: string;
  invoice_prefix: string;
}

const EMPTY_FORM: SettingsForm = {
  sales_points_per_sale: '',
  prospect_points_per_add: '',
  prospect_points_per_conversion: '',
  inactivity_period_days: '',
  inactivity_penalty_points: '',
  default_commission_type: 'none',
  default_commission_value: '',
  invoice_prefix: '',
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('general');

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settingsPage.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('settingsPage.subtitle')}</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800">
        {([
          ['general', t('settingsPage.tabGeneral')],
          ['accounting-cats', t('settingsPage.tabAccountingCategories')],
          ['service-cats', t('settingsPage.tabServiceCategories')],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? 'bg-white text-brand-700 shadow-sm dark:bg-gray-900 dark:text-brand-300'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && <GeneralSettingsTab />}
      {activeTab === 'accounting-cats' && <AccountingCategoriesTab />}
      {activeTab === 'service-cats' && <ServiceCategoriesTab />}
    </div>
  );
}

function GeneralSettingsTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [form, setForm] = useState<SettingsForm>(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    settingsApi
      .list()
      .then((settings) => {
        const map = new Map(settings.map((s) => [s.key, s.value]));
        setForm({
          sales_points_per_sale: String(map.get('sales_points_per_sale') ?? 3),
          prospect_points_per_add: String(map.get('prospect_points_per_add') ?? 2),
          prospect_points_per_conversion: String(map.get('prospect_points_per_conversion') ?? 5),
          inactivity_period_days: String(map.get('inactivity_period_days') ?? 14),
          inactivity_penalty_points: String(map.get('inactivity_penalty_points') ?? 5),
          default_commission_type: (map.get('default_commission_type') as CommissionType) ?? 'none',
          default_commission_value: String(map.get('default_commission_value') ?? 0),
          invoice_prefix: String(map.get('invoice_prefix') ?? 'PK'),
        });
      })
      .catch((error) => setLoadError(extractErrorMessage(error, t('settingsPage.loadFailed'))))
      .finally(() => setIsLoading(false));
  }, [t]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setFormErrors({});
    try {
      await settingsApi.update({
        sales_points_per_sale: Number(form.sales_points_per_sale),
        prospect_points_per_add: Number(form.prospect_points_per_add),
        prospect_points_per_conversion: Number(form.prospect_points_per_conversion),
        inactivity_period_days: Number(form.inactivity_period_days),
        inactivity_penalty_points: Number(form.inactivity_penalty_points),
        default_commission_type: form.default_commission_type,
        default_commission_value: Number(form.default_commission_value),
        invoice_prefix: form.invoice_prefix.trim() || 'PK',
      });
      showToast(t('settingsPage.saved'), 'success');
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('settingsPage.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <SkeletonDetail />;

  return (
    <>
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {Object.keys(formErrors).length > 0 && (
        <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settingsPage.sales')}</h2>
          <Input label={t('settingsPage.salesPointsPerSale')} hint={t('settingsPage.salesPointsPerSaleHint')} type="number" min="0" max="1000" required value={form.sales_points_per_sale} onChange={(e) => setForm((p) => ({ ...p, sales_points_per_sale: e.target.value }))} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settingsPage.prospects')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('settingsPage.prospectPointsPerAdd')} hint={t('settingsPage.prospectPointsPerAddHint')} type="number" min="0" max="1000" required value={form.prospect_points_per_add} onChange={(e) => setForm((p) => ({ ...p, prospect_points_per_add: e.target.value }))} />
            <Input label={t('settingsPage.prospectPointsPerConversion')} hint={t('settingsPage.prospectPointsPerConversionHint')} type="number" min="0" max="1000" required value={form.prospect_points_per_conversion} onChange={(e) => setForm((p) => ({ ...p, prospect_points_per_conversion: e.target.value }))} />
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settingsPage.inactivity')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label={t('settingsPage.inactivityPeriodDays')} hint={t('settingsPage.inactivityPeriodDaysHint')} type="number" min="1" max="365" required value={form.inactivity_period_days} onChange={(e) => setForm((p) => ({ ...p, inactivity_period_days: e.target.value }))} />
            <Input label={t('settingsPage.inactivityPenaltyPoints')} hint={t('settingsPage.inactivityPenaltyPointsHint')} type="number" min="0" max="1000" required value={form.inactivity_penalty_points} onChange={(e) => setForm((p) => ({ ...p, inactivity_penalty_points: e.target.value }))} />
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settingsPage.commission')}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('settingsPage.defaultCommissionType')} value={form.default_commission_type} onChange={(e) => setForm((p) => ({ ...p, default_commission_type: e.target.value as CommissionType }))}>
              <option value="none">{t('settingsPage.commissionNone')}</option>
              <option value="percent">{t('settingsPage.commissionPercent')}</option>
              <option value="fixed">{t('settingsPage.commissionFixed')}</option>
            </Select>
            <Input label={t('settingsPage.defaultCommissionValue')} type="number" min="0" step="0.01" required value={form.default_commission_value} onChange={(e) => setForm((p) => ({ ...p, default_commission_value: e.target.value }))} />
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">{t('settingsPage.invoicePrefix')}</h2>
          <Input label={t('settingsPage.invoicePrefix')} hint={t('settingsPage.invoicePrefixHint')} maxLength={5} required value={form.invoice_prefix} onChange={(e) => setForm((p) => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))} />
        </div>
        <div className="flex justify-end">
          <Button type="submit" isLoading={isSaving}><Save className="h-4 w-4" />{t('settingsPage.save')}</Button>
        </div>
      </form>
    </>
  );
}

function AccountingCategoriesTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<AccountingCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AccountingCategory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AccountingCategory | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountingType>('income');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await accountingApi.categories();
      setCategories(data);
    } catch (error) {
      showToast(extractErrorMessage(error, t('settingsPage.loadFailed')), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openCreate() {
    setEditTarget(null);
    setName('');
    setType('income');
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(c: AccountingCategory) {
    setEditTarget(c);
    setName(c.name);
    setType(c.type);
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    try {
      if (editTarget) {
        await accountingApi.updateCategory(editTarget.id, { name: name.trim(), type });
        showToast(t('settingsPage.categoryUpdated'), 'success');
      } else {
        await accountingApi.createCategory({ name: name.trim(), type });
        showToast(t('settingsPage.categoryCreated'), 'success');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, '');
      if (msg) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await accountingApi.removeCategory(deleteTarget.id);
      showToast(t('settingsPage.categoryDeleted'), 'success');
      setDeleteTarget(null);
      fetchCategories();
    } catch (error) {
      showToast(extractErrorMessage(error, ''), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <SkeletonDetail />;

  const incomeCats = categories.filter((c) => c.type === 'income');
  const expenseCats = categories.filter((c) => c.type === 'expense');

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('settingsPage.newCategory')}</Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('settingsPage.colName')}</th>
                <th className="px-5 py-3 font-medium">{t('settingsPage.colType')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">{c.name}</td>
                  <td className="px-5 py-3">
                    <Badge variant={c.type === 'income' ? 'success' : 'error'}>
                      {c.type === 'income' ? t('accounting.typeIncome') : t('accounting.typeExpense')}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(c)} className="text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-sm text-gray-400">{t('settingsPage.noCategories')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t('settingsPage.editCategory') : t('settingsPage.newCategory')} maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>}
          <Input label={t('settingsPage.colName')} required value={name} onChange={(e) => setName(e.target.value)} error={formErrors.name} />
          <Select label={t('settingsPage.colType')} required value={type} onChange={(e) => setType(e.target.value as AccountingType)}>
            <option value="income">{t('accounting.typeIncome')}</option>
            <option value="expense">{t('accounting.typeExpense')}</option>
          </Select>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('settingsPage.deleteCategoryTitle')}
        message={t('settingsPage.deleteCategoryMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function ServiceCategoriesTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await categoriesApi.list({ per_page: 200 });
      setCategories(res.data);
    } catch (error) {
      showToast(extractErrorMessage(error, t('settingsPage.loadFailed')), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast]);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function openCreate() {
    setEditTarget(null);
    setName('');
    setDescription('');
    setColor('');
    setFormErrors({});
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditTarget(c);
    setName(c.name);
    setDescription(c.description ?? '');
    setColor(c.color ?? '');
    setFormErrors({});
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormErrors({});
    try {
      const payload = { name: name.trim(), description: description.trim() || undefined, color: color.trim() || undefined };
      if (editTarget) {
        await categoriesApi.update(editTarget.id, payload);
        showToast(t('settingsPage.categoryUpdated'), 'success');
      } else {
        await categoriesApi.create(payload);
        showToast(t('settingsPage.categoryCreated'), 'success');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, '');
      if (msg) showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsSubmitting(true);
    try {
      await categoriesApi.remove(deleteTarget.id);
      showToast(t('settingsPage.categoryDeleted'), 'success');
      setDeleteTarget(null);
      fetchCategories();
    } catch (error) {
      showToast(extractErrorMessage(error, ''), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <SkeletonDetail />;

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('settingsPage.newCategory')}</Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-5 py-3 font-medium">{t('settingsPage.colName')}</th>
                <th className="px-5 py-3 font-medium">{t('settingsPage.colDescription')}</th>
                <th className="px-5 py-3 font-medium">{t('settingsPage.colServices')}</th>
                <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {c.color && <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />}
                      {c.name}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{c.description ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-300">{c.services_count ?? 0}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => openEdit(c)} className="text-gray-400 hover:text-gray-600"><Pencil className="h-4 w-4" /></button>
                      <button type="button" onClick={() => setDeleteTarget(c)} className="text-gray-400 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-400">{t('settingsPage.noCategories')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? t('settingsPage.editCategory') : t('settingsPage.newCategory')} maxWidth="max-w-md">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>}
          <Input label={t('settingsPage.colName')} required value={name} onChange={(e) => setName(e.target.value)} error={formErrors.name} />
          <Input label={t('settingsPage.colDescription')} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Input label={t('settingsPage.colColor')} type="color" value={color || '#6366f1'} onChange={(e) => setColor(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('settingsPage.deleteCategoryTitle')}
        message={t('settingsPage.deleteCategoryMessage', { name: deleteTarget?.name ?? '' })}
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={isSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
