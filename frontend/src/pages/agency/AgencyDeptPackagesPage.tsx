import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Tag, Trash2, X } from 'lucide-react';
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
import { PackageCard, groupPackagesByCategory } from '@/components/packages/PackageCard';
import { PackageFormModal } from '@/components/agencyDept/PackageFormModal';
import type { AgencyPackage } from '@/types/agencyDepartment';

/** Packages Agency : cartes façon flyer, groupées par catégorie (§6.2). */
export default function AgencyDeptPackagesPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { departmentId, agencyId, basePath } = useAgencyDept();
  const canManage = canManagePackages(user);

  const [packages, setPackages] = useState<AgencyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<AgencyPackage | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const [promoTarget, setPromoTarget] = useState<AgencyPackage | null>(null);
  const [subscribeTarget, setSubscribeTarget] = useState<AgencyPackage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgencyPackage | null>(null);

  const load = useCallback(() => {
    if (!departmentId) return;
    setLoading(true);
    agencyDeptApi
      .packages({ department_id: departmentId })
      .then(setPackages)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))))
      .finally(() => setLoading(false));
  }, [departmentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(
    () => groupPackagesByCategory(packages, t('agencyDept.packages.uncategorized')),
    [packages, t],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: AgencyPackage) {
    setEditing(p);
    setFormOpen(true);
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
                  onOpen={() => navigate(`${basePath}/packages/${p.id}/subscriptions`)}
                  onSubscriptions={() => navigate(`${basePath}/packages/${p.id}/subscriptions`)}
                  onDelete={() => setDeleteTarget(p)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <PackageFormModal
        isOpen={formOpen}
        agencyId={agencyId}
        departmentId={departmentId}
        editing={editing}
        canManage={canManage}
        onClose={() => setFormOpen(false)}
        onSaved={load}
      />

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
