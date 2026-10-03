import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { canManagePackages } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { CommercialPicker } from '@/components/agencyDept/Pickers';
import type { CommissionEntry, CommissionRule } from '@/types/commissions';
import type { AgencyPackage } from '@/types/agencyDepartment';

/**
 * Commissions Agency (§6.10) : règles PAR PACKAGE (D13), déclenchées au paiement (D6).
 * Les prestations hors package portent leur propre taux (D17), saisi sur la prestation.
 */
export default function AgencyDeptCommissionsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { departmentId, agencyId } = useAgencyDept();
  const canManage = canManagePackages(user);

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [entries, setEntries] = useState<CommissionEntry[] | null>(null);
  const [packages, setPackages] = useState<AgencyPackage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ name: '', package_id: '', formula_type: 'percent', value: '', beneficiary_commercial_id: '' });

  const load = useCallback(() => {
    commissionsApi.listRules().then((all) => setRules(all.filter((r) => r.package_id))).catch(() => {});
    commissionsApi
      .listEntries({ category: 'agency', agency_id: agencyId, per_page: 50 })
      .then((r) => setEntries(r.data))
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [agencyId, t]);

  useEffect(() => {
    load();
    if (departmentId) agencyDeptApi.packages({ department_id: departmentId }).then(setPackages).catch(() => {});
  }, [load, departmentId]);

  async function createRule(e: FormEvent) {
    e.preventDefault();
    try {
      await commissionsApi.createRule({
        name: form.name || `Commission ${packages.find((p) => p.id === form.package_id)?.name ?? ''}`,
        package_id: form.package_id,
        beneficiary_commercial_id: form.beneficiary_commercial_id || undefined,
        trigger_event: 'on_payment',
        formula_type: form.formula_type,
        percent_value: form.formula_type === 'percent' ? Number(form.value) : undefined,
        fixed_amount: form.formula_type === 'fixed' ? Number(form.value) : undefined,
      });
      setFormOpen(false);
      showToast(t('agencyDept.saved'), 'success');
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.commissions')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.commissions.subtitle')}</p>
        </div>
        {canManage && <Button onClick={() => setFormOpen(true)}><Plus className="h-4 w-4" /> {t('agencyDept.commissions.newRule')}</Button>}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{t('agencyDept.commissions.rules')}</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500">{t('agencyDept.commissions.noRules')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-400">
              <tr><th className="py-2">{t('agencyDept.name')}</th><th>{t('nav.packages')}</th><th>{t('agencyDept.commissions.rate')}</th><th>{t('agencyDept.commercial')}</th><th>{t('common.status')}</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rules.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.name} <span className="text-xs text-gray-400">v{r.version}</span></td>
                  <td>{r.package?.name ?? packages.find((p) => p.id === r.package_id)?.name ?? '—'}</td>
                  <td>{r.formula_type === 'percent' ? `${Number(r.percent_value)} %` : formatCurrency(r.fixed_amount)}</td>
                  <td>{r.beneficiary ? `${r.beneficiary.first_name} ${r.beneficiary.last_name}` : t('agencyDept.commissions.seller')}</td>
                  <td>{r.is_active ? t('common.active') : t('common.inactive')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <h2 className="px-5 pt-5 font-semibold text-gray-900 dark:text-white">{t('agencyDept.commissions.entries')}</h2>
        {!entries ? (
          <SkeletonTable />
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="mt-3 w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('agencyDept.commercial')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.invoices')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencyDept.commissions.source')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencyDept.commissions.base')}</th>
                  <th className="px-5 py-3 font-medium">{t('agencyDept.amount')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-5 py-3">{e.beneficiary ? `${e.beneficiary.first_name} ${e.beneficiary.last_name}` : '—'}</td>
                    <td className="px-5 py-3">{e.invoice?.number ?? '—'}</td>
                    <td className="px-5 py-3">{e.product_type === 'prestation' ? t('agencyDept.commissions.fromPrestation') : t('agencyDept.commissions.fromPackage')}</td>
                    <td className="px-5 py-3">{formatCurrency(e.base_amount)}</td>
                    <td className="px-5 py-3 font-medium">{formatCurrency(e.amount)}</td>
                    <td className="px-5 py-3">{t(`agencyDept.commissions.status.${e.status}`, e.status)}</td>
                    <td className="px-5 py-3">
                      {canManage && e.status === 'calculated' && <Button size="sm" variant="outline" onClick={() => act(() => commissionsApi.validateEntry(e.id))}>{t('agencyDept.commissions.validate')}</Button>}
                      {canManage && e.status === 'validated' && <Button size="sm" onClick={() => act(() => commissionsApi.payEntry(e.id))}>{t('agencyDept.commissions.pay')}</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={t('agencyDept.commissions.newRule')}>
        <form onSubmit={createRule} className="flex flex-col gap-3">
          <p className="text-xs text-gray-500">{t('agencyDept.commissions.ruleHint')}</p>
          <Select label={t('nav.packages')} required value={form.package_id} onChange={(e) => setForm({ ...form, package_id: e.target.value })}>
            <option value="">—</option>
            {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Input label={t('agencyDept.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('agencyDept.commissions.formula')} value={form.formula_type} onChange={(e) => setForm({ ...form, formula_type: e.target.value })}>
              <option value="percent">%</option>
              <option value="fixed">{t('agencyDept.prestations.fixedAmount')}</option>
            </Select>
            <Input label={t('agencyDept.commissions.rate')} type="number" min={0} required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
          </div>
          <CommercialPicker label={t('agencyDept.commissions.beneficiaryOptional')} value={form.beneficiary_commercial_id} onChange={(id) => setForm({ ...form, beneficiary_commercial_id: id })} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={!form.package_id || !form.value}>{t('common.create')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
