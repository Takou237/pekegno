import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { contractsApi } from '@/api/contracts.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import { canManageContracts } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ClientPicker } from '@/components/agencyDept/Pickers';
import {
  BILLING_CYCLE_LABELS,
  CONTRACT_STATUSES,
  CONTRACT_STATUS_COLORS,
  CONTRACT_STATUS_LABELS,
  type BillingCycle,
  type Contract,
  type ContractOrigin,
} from '@/types/contract';
import type { LaravelPage } from '@/types/agencyDepartment';

const ORIGIN_TABS: Array<ContractOrigin | ''> = ['', 'package', 'prestation', 'manual'];

/**
 * Contrats du département (§6.8). Une souscription à un package EST un contrat
 * (D1) : l'onglet « Packages » remplace l'ancienne page « Souscriptions ».
 * L'onglet actif est dans l'URL (`?origin=package`).
 */
export default function ContractListPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { departmentId, agencyId, basePath } = useAgencyDept();

  const [result, setResult] = useState<LaravelPage<Contract> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const originFilter = (searchParams.get('origin') ?? '') as ContractOrigin | '';
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    contractsApi
      .list({
        department_id: departmentId,
        status: status || undefined,
        origin: (originFilter || undefined) as ContractOrigin | undefined,
        search: search || undefined,
        page,
        per_page: 15,
      })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [departmentId, status, originFilter, search, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function selectOrigin(o: ContractOrigin | '') {
    setSearchParams(o ? { origin: o } : {}, { replace: true });
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.contracts')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.contracts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
          {originFilter === 'package' && (
            <Link to={`${basePath}/packages`}><Button><Plus className="h-4 w-4" /> {t('agencyDept.packages.subscribe')}</Button></Link>
          )}
          {originFilter !== 'package' && canManageContracts(user) && (
            <Button variant={originFilter === '' ? 'primary' : 'outline'} onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> {t('agencyDept.contracts.newManual')}</Button>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {ORIGIN_TABS.map((o) => (
          <button
            key={o || 'all'}
            type="button"
            onClick={() => selectOrigin(o)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${originFilter === o ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {o ? t(`agencyDept.contracts.tabs.${o}`) : t('agencyDept.contracts.tabs.all')}
          </button>
        ))}
      </div>
      {originFilter === 'package' && <p className="-mt-3 text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.contracts.packagesHint')}</p>}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">{t('agencyDept.allStatuses')}</option>
          {CONTRACT_STATUSES.map((s) => <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>)}
        </Select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.contracts.empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">N°</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.client')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.contracts.originCol')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.contracts.object')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.amount')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.period')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-3">
                      <Link to={`${basePath}/contracts/${c.id}`} className="font-medium text-brand-600 hover:underline">{c.number}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.client ? `${c.client.first_name} ${c.client.last_name}` : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{t(`agencyDept.contracts.origin.${c.origin ?? 'manual'}`)}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {c.prestation ? (
                        <Link to={`${basePath}/prestations/${c.prestation.id}`} className="hover:underline">{c.prestation.name}</Link>
                      ) : c.pack?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-200">{formatCurrency(c.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{c.start_date.slice(0, 10)} → {c.end_date.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>{CONTRACT_STATUS_LABELS[c.status]}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.last_page > 1 && (
        <Pagination currentPage={result.current_page} lastPage={result.last_page} total={result.total} perPage={result.per_page} onPageChange={setPage} />
      )}

      {createOpen && agencyId && (
        <ManualContractModal
          agencyId={agencyId}
          departmentId={departmentId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            showToast(t('agencyDept.saved'), 'success');
            load();
          }}
        />
      )}
    </div>
  );
}

function ManualContractModal({ agencyId, departmentId, onClose, onCreated }: { agencyId: string; departmentId?: string; onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ client_id: '', start_date: todayLocal(), end_date: '', billing_cycle: 'monthly' as BillingCycle, amount: '', auto_renew: false, notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await contractsApi.create({
        client_id: form.client_id,
        agency_id: agencyId,
        department_id: departmentId,
        start_date: form.start_date,
        end_date: form.end_date,
        billing_cycle: form.billing_cycle,
        amount: Number(form.amount),
        auto_renew: form.auto_renew,
        notes: form.notes || undefined,
      });
      onCreated();
    } catch (err) {
      setError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={t('agencyDept.contracts.newManual')}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {error && <Alert variant="error">{error}</Alert>}
        <p className="text-xs text-gray-500">{t('agencyDept.contracts.manualHint')}</p>
        <ClientPicker value={form.client_id} onChange={(id) => setForm({ ...form, client_id: id })} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label={t('agencyDept.startDate')} type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
          <Input label={t('agencyDept.endDate')} type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          <Select label={t('agencyDept.contracts.billingCycle')} value={form.billing_cycle} onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as BillingCycle })}>
            {(Object.keys(BILLING_CYCLE_LABELS) as BillingCycle[]).map((b) => <option key={b} value={b}>{BILLING_CYCLE_LABELS[b]}</option>)}
          </Select>
          <Input label={t('agencyDept.amount')} type="number" min={0} required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={form.auto_renew} onChange={(e) => setForm({ ...form, auto_renew: e.target.checked })} /> {t('agencyDept.packages.autoRenew')}
        </label>
        <Input label={t('agencyDept.comment')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" isLoading={saving} disabled={!form.client_id}>{t('common.create')}</Button>
        </div>
      </form>
    </Modal>
  );
}
