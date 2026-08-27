import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Pencil, Trash2, History } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import type { CommissionRule } from '@/types/commissions';

export default function CommissionRulesPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterActive, setFilterActive] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState({
    name: '', trigger_event: 'on_payment', formula_type: 'percent',
    percent_value: '', fixed_amount: '', scope_agency_id: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CommissionRule[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    commissionsApi.listRules()
      .then(setRules)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditRule(null);
    setForm({ name: '', trigger_event: 'on_payment', formula_type: 'percent', percent_value: '', fixed_amount: '', scope_agency_id: '' });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setEditRule(rule);
    setForm({
      name: rule.name,
      trigger_event: rule.trigger_event,
      formula_type: rule.formula_type,
      percent_value: rule.percent_value?.toString() ?? '',
      fixed_amount: rule.fixed_amount?.toString() ?? '',
      scope_agency_id: rule.scope_agency_id ?? '',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    const payload = {
      name: form.name,
      trigger_event: form.trigger_event,
      formula_type: form.formula_type,
      percent_value: form.formula_type === 'percent' ? Number(form.percent_value) : undefined,
      fixed_amount: form.formula_type === 'fixed' ? Number(form.fixed_amount) : undefined,
      scope_agency_id: form.scope_agency_id || undefined,
    };
    try {
      if (editRule) {
        await commissionsApi.updateRule(editRule.id, payload);
        showToast(t('commissions.ruleUpdated'), 'success');
      } else {
        await commissionsApi.createRule(payload);
        showToast(t('commissions.ruleCreated'), 'success');
      }
      setFormOpen(false);
      load();
    } catch (error) {
      const errs = (error as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors;
      if (errs) {
        const mapped: Record<string, string> = {};
        for (const [k, v] of Object.entries(errs)) mapped[k] = v[0] ?? '';
        setFormErrors(mapped);
      } else {
        setFormErrors({ general: extractErrorMessage(error, t('common.error')) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm(t('commissions.confirmDeactivate'))) return;
    try {
      await commissionsApi.deactivateRule(id);
      showToast(t('commissions.ruleDeactivated'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function showVersions(rule: CommissionRule) {
    try {
      const versions = await commissionsApi.ruleVersions(rule.id);
      setVersions(versions);
      setVersionsOpen(true);
    } catch {
      showToast(t('common.error'), 'error');
    }
  }

  const filtered = filterActive === '' ? rules : rules.filter((r) => r.is_active === (filterActive === 'true'));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commissions.rulesTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissions.rulesSubtitle')}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('commissions.newRule')}</Button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <Select label={t('commissions.filterByActive')} value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
            <option value="">{t('common.all')}</option>
            <option value="true">{t('common.active')}</option>
            <option value="false">{t('common.inactive')}</option>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('commissions.noRules')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="py-2 pr-3 font-medium">{t('commissions.ruleName')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.trigger')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.formula')}</th>
                  <th className="py-2 pr-3 font-medium">{t('commissions.version')}</th>
                  <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                  <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((rule) => (
                  <tr key={rule.id}>
                    <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{rule.name}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{t(`commissions.trigger_${rule.trigger_event}`)}</td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                      {rule.formula_type === 'percent' && `${rule.percent_value}%`}
                      {rule.formula_type === 'fixed' && formatCurrency(rule.fixed_amount ?? 0)}
                      {rule.formula_type === 'tiered' && t('commissions.tiered')}
                    </td>
                    <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">v{rule.version}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        rule.is_active
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {rule.is_active ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => showVersions(rule)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={t('commissions.history')}>
                          <History className="h-4 w-4" />
                        </button>
                        {rule.is_active && <button onClick={() => openEdit(rule)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={t('common.edit')}>
                          <Pencil className="h-4 w-4" />
                        </button>}
                        {rule.is_active && <button onClick={() => handleDeactivate(rule.id)} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('common.delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editRule ? t('commissions.editRule') : t('commissions.newRule')} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formErrors.general && <Alert variant="error">{formErrors.general}</Alert>}
          <Input label={t('commissions.ruleName')} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={formErrors.name} />
          <Select label={t('commissions.trigger')} required value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })}>
            <option value="on_sale">{t('commissions.trigger_on_sale')}</option>
            <option value="on_payment">{t('commissions.trigger_on_payment')}</option>
            <option value="on_full_payment">{t('commissions.trigger_on_full_payment')}</option>
          </Select>
          <Select label={t('commissions.formula')} required value={form.formula_type} onChange={(e) => setForm({ ...form, formula_type: e.target.value })}>
            <option value="percent">{t('commissions.formulaPercent')}</option>
            <option value="fixed">{t('commissions.formulaFixed')}</option>
          </Select>
          {form.formula_type === 'percent' && (
            <Input label={t('commissions.percentValue')} type="number" min={0} max={100} step="0.01" required value={form.percent_value} onChange={(e) => setForm({ ...form, percent_value: e.target.value })} error={formErrors.percent_value} />
          )}
          {form.formula_type === 'fixed' && (
            <Input label={t('commissions.fixedAmount')} type="number" min={0} step="0.01" required value={form.fixed_amount} onChange={(e) => setForm({ ...form, fixed_amount: e.target.value })} error={formErrors.fixed_amount} />
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={submitting} className="flex-1">{editRule ? t('common.save') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>

      {/* Versions modal */}
      <Modal isOpen={versionsOpen} onClose={() => setVersionsOpen(false)} title={t('commissions.versionHistory')} maxWidth="max-w-lg">
        {versions.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('commissions.noVersions')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                <div>
                  <span className="font-medium">v{v.version}</span>
                  <span className="ml-2 text-sm text-gray-500">
                    {v.formula_type === 'percent' ? `${v.percent_value}%` : formatCurrency(v.fixed_amount ?? 0)}
                  </span>
                </div>
                <span className={`text-xs font-medium ${v.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                  {v.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
