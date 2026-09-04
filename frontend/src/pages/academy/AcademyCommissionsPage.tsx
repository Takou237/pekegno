import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Banknote, RefreshCw, History } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { academyApi } from '@/api/academy.api';
import { sellerProfilesApi } from '@/api/sellerProfiles.api';
import { commercialsApi } from '@/api/commercials.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { CommissionBeneficiary, CommissionRule, CommissionPaymentPayload, CommissionPaymentMethod } from '@/types/commissions';
import { COMMISSION_PAYMENT_METHODS } from '@/types/commissions';
import type { SellerProfile } from '@/types/formation';
import type { Commercial } from '@/types/commercial';

interface DepartmentLayoutContext {
  department?: { id: string; type: string; agency_id?: string | null } | null;
  departmentId?: string;
  agencyId?: string;
}

const TABS = ['rules', 'balances', 'sellers'] as const;
type Tab = (typeof TABS)[number];

interface PayFormState {
  amount: string;
  payment_method: CommissionPaymentMethod;
  note: string;
}

const emptyPayForm: PayFormState = { amount: '', payment_method: 'especes', note: '' };
const TRIGGERS = ['on_sale', 'on_payment', 'on_full_payment'] as const;

export default function AcademyCommissionsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [tab, setTab] = useState<Tab>('rules');

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);
  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<CommissionBeneficiary[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<CommissionRule | null>(null);
  const [form, setForm] = useState({
    name: '', course_id: '', beneficiary_type: 'seller_profile' as 'seller_profile' | 'commercial',
    beneficiary_id: '', formula_type: 'percent' as 'percent' | 'fixed', value: '',
    trigger_event: 'on_payment' as 'on_sale' | 'on_payment' | 'on_full_payment',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CommissionRule[]>([]);
  const [payModal, setPayModal] = useState<CommissionBeneficiary | null>(null);
  const [payForm, setPayForm] = useState({ amount: '', payment_method: 'especes' as CommissionPaymentMethod, note: '' });
  const [isPaying, setIsPaying] = useState(false);

  const loadRules = useCallback(() => {
    setRulesLoading(true);
    commissionsApi.listRules().then(setRules).catch(() => {}).finally(() => setRulesLoading(false));
  }, []);

  const loadSellers = useCallback(() => {
    if (!agencyId) return;
    sellerProfilesApi.list({ agency_id: agencyId, per_page: 100 }).then((res) => setSellers(res.data)).catch(() => {});
  }, [agencyId]);

  const loadCommercials = useCallback(() => {
    if (!agencyId) return;
    commercialsApi.list({ agency_id: agencyId, per_page: 100 }).then((res) => setCommercials(res.data)).catch(() => {});
  }, [agencyId]);

  const loadBalances = useCallback(() => {
    setBalancesLoading(true);
    commissionsApi.summaryBeneficiaries({ agency_id: agencyId ?? undefined })
      .then((res) => setBeneficiaries(res.data))
      .catch(() => {})
      .finally(() => setBalancesLoading(false));
  }, [agencyId]);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadSellers(); }, [loadSellers]);
  useEffect(() => { loadCommercials(); }, [loadCommercials]);
  useEffect(() => { if (tab === 'balances') loadBalances(); }, [tab, loadBalances]);
  function openCreate() {
    setEditRule(null);
    setForm({
      name: '', course_id: '', beneficiary_type: 'seller_profile', beneficiary_id: '',
      formula_type: 'percent', value: '', trigger_event: 'on_payment',
    });
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(rule: CommissionRule) {
    setEditRule(rule);
    setForm({
      name: rule.name,
      course_id: rule.course_id ?? '',
      beneficiary_type: rule.beneficiary_seller_profile_id ? 'seller_profile' : 'commercial',
      beneficiary_id: rule.beneficiary_seller_profile_id ?? rule.beneficiary_commercial_id ?? '',
      formula_type: rule.formula_type === 'fixed' ? 'fixed' : 'percent',
      value: rule.formula_type === 'fixed' ? String(rule.fixed_amount ?? '') : String(rule.percent_value ?? ''),
      trigger_event: rule.trigger_event,
    });
    setFormOpen(true);
  }

  function beneficiaryName(rule: CommissionRule): string {
    if (rule.beneficiary_seller_profile_id) {
      const u = rule.sellerProfile?.user;
      return u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email : t('academy.sellerProfile');
    }
    if (rule.beneficiary) {
      return `${rule.beneficiary.first_name} ${rule.beneficiary.last_name}`;
    }
    return '—';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    try {
      const payload = {
        name: form.name,
        course_id: form.course_id || undefined,
        trigger_event: form.trigger_event,
        formula_type: form.formula_type,
        ...(form.formula_type === 'percent'
          ? { percent_value: Number(form.value), fixed_amount: undefined }
          : { fixed_amount: Number(form.value), percent_value: undefined }),
        ...(form.beneficiary_type === 'seller_profile'
          ? { beneficiary_seller_profile_id: form.beneficiary_id || undefined }
          : { beneficiary_commercial_id: form.beneficiary_id || undefined }),
      };
      if (editRule) {
        await commissionsApi.updateRule(editRule.id, payload);
        showToast(t('commissions.ruleUpdated'), 'success');
      } else {
        await commissionsApi.createRule(payload);
        showToast(t('commissions.ruleCreated'), 'success');
      }
      setFormOpen(false);
      loadRules();
    } catch (error) {
      const errs = (error as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data?.errors;
      if (errs && Object.keys(errs).length) {
        const flat: Record<string, string> = {};
        for (const [k, v] of Object.entries(errs)) flat[k] = v[0] ?? v.join(' ');
        setFormErrors(flat);
      } else {
        setFormErrors({ general: extractErrorMessage(error, t('common.error')) });
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(rule: CommissionRule) {
    try {
      await commissionsApi.deactivateRule(rule.id);
      showToast(t('commissions.ruleDeactivated'), 'success');
      loadRules();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  async function handleShowVersions(rule: CommissionRule) {
    try {
      const res = await commissionsApi.ruleVersions(rule.id);
      setVersions(res);
      setVersionsOpen(true);
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    }
  }

  function openPayModal(beneficiary: CommissionBeneficiary) {
    setPayModal(beneficiary);
    setPayForm(emptyPayForm);
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!payModal) return;
    setIsPaying(true);
    try {
      const payload: CommissionPaymentPayload = {
        beneficiary_type: payModal.type,
        beneficiary_id: payModal.id,
        amount: Number(payForm.amount),
        payment_method: payForm.payment_method,
        note: payForm.note || undefined,
      };
      await commissionsApi.payCommission(payload);
      showToast(t('academy.commissionPaid'), 'success');
      setPayModal(null);
      loadBalances();
      loadRules();
    } catch (error) {
      const msg = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setIsPaying(false);
    }
  }

  function sellerLabel(sp: SellerProfile): string {
    if (!sp.user) return t('academy.sellerProfile');
    return `${sp.user.first_name ?? ''} ${sp.user.last_name ?? ''}`.trim() || sp.user.email;
  }

  function commercialLabel(c: Commercial): string {
    const label = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim();
    return label || c.email || t('commissions.beneficiary');
  }

  function selectedBalance(b: CommissionBeneficiary): number {
    return Number(b.balance ?? 0);
  }

  const fetchCourses = useCallback(async (query: string) => {
    if (!agencyId) return [];
    const trimmed = query.trim();
    const res = await academyApi.courses({ agency_id: agencyId, search: trimmed || undefined, per_page: 100 });
    return res.data.map((c) => ({ id: c.id, label: `${c.name} (${c.code})` }));
  }, [agencyId]);

  const fetchSellerOptions = useCallback(async (query: string) => {
    const q = query.trim().toLowerCase();
    const active = sellers.filter((s) => s.is_active);
    const match = q
      ? active.filter((s) => `${sellerLabel(s)} ${s.user?.email ?? ''}`.toLowerCase().includes(q))
      : active;
    return match.map((s) => ({
      id: s.id,
      label: sellerLabel(s),
      subtitle: t(`sellerProfiles.kind${s.kind.charAt(0).toUpperCase()}${s.kind.slice(1)}`),
    }));
  }, [sellers]);

  const fetchCommercialOptions = useCallback(async (query: string) => {
    const q = query.trim().toLowerCase();
    const active = commercials.filter((c) => c.is_active);
    const match = q
      ? active.filter((c) => `${commercialLabel(c)} ${c.email ?? ''}`.toLowerCase().includes(q))
      : active;
    return match.map((c) => ({ id: c.id, label: commercialLabel(c), subtitle: c.kind }));
  }, [commercials]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('academy.commissionsTitle')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.commissionsSubtitle')}</p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-brand-600 text-white dark:bg-brand-500'
                : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
            }`}
          >
            {t(`academy.commissionsTab${key.charAt(0).toUpperCase()}${key.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Onglet Règles */}
      {tab === 'rules' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('commissions.rulesTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissions.rulesSubtitle')}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadRules}><RefreshCw className="h-4 w-4" /></Button>
                <Button onClick={openCreate}><Plus className="h-4 w-4" />{t('commissions.newRule')}</Button>
              </div>
            </div>

            {rulesLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : rules.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('commissions.noRules')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      <th className="py-2 pr-3 font-medium">{t('commissions.ruleName')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.courseLabel')}</th>
                      <th className="py-2 pr-3 font-medium">{t('commissions.beneficiary')}</th>
                      <th className="py-2 pr-3 font-medium">{t('commissions.formula')}</th>
                      <th className="py-2 pr-3 font-medium">{t('commissions.trigger')}</th>
                      <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                      <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rules.map((rule) => (
                      <tr key={rule.id}>
                        <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{rule.name}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                          {rule.course ? `${rule.course.name} (${rule.course.code})` : t('academy.allCourses')}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{beneficiaryName(rule)}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                          {rule.formula_type === 'percent' ? `${rule.percent_value}%` : formatCurrency(rule.fixed_amount ?? 0)}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{t(`commissions.trigger_${rule.trigger_event}`)}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {rule.is_active ? t('common.active') : t('common.inactive')}
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button type="button" onClick={() => handleShowVersions(rule)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={t('commissions.versionHistory')}>
                              <History className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => openEdit(rule)} className="rounded p-1 text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10" title={t('commissions.editRule')}>
                              <span className="text-sm">✎</span>
                            </button>
                            <button type="button" onClick={() => handleDeactivate(rule)} className="rounded p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10" title={t('commissions.ruleDeactivated')}>
                              <span className="text-sm">✕</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Onglet Soldes & paiements */}
      {tab === 'balances' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.totalCommissionsOwed')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(beneficiaries.reduce((sum, b) => sum + Number(b.balance || 0), 0))}
              </p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('academy.totalCommissionsPaid')}</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(beneficiaries.reduce((sum, b) => sum + Number(b.total_paid || 0), 0))}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('academy.beneficiariesTitle')}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.beneficiariesSubtitle')}</p>
              </div>
              <Button variant="outline" onClick={loadBalances}><RefreshCw className="h-4 w-4" /></Button>
            </div>

            {balancesLoading ? (
              <div className="flex justify-center py-8"><Spinner /></div>
            ) : beneficiaries.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noBeneficiaries')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                      <th className="py-2 pr-3 font-medium">{t('commissions.beneficiary')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.kind')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.totalOwed')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.totalPaid')}</th>
                      <th className="py-2 pr-3 font-medium">{t('academy.balanceLabel')}</th>
                      <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {beneficiaries.map((b) => (
                      <tr key={`${b.type}-${b.id}`}>
                        <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{b.name}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                          {b.type === 'seller_profile'
                            ? t(`sellerProfiles.kind${b.kind?.charAt(0).toUpperCase()}${b.kind?.slice(1)}`)
                            : b.kind}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{formatCurrency(Number(b.total_owed ?? 0))}</td>
                        <td className="py-2 pr-3 text-emerald-600 dark:text-emerald-400">{formatCurrency(Number(b.total_paid ?? 0))}</td>
                        <td className={`py-2 pr-3 font-medium ${Number(b.balance) > 0 ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>
                          {formatCurrency(Number(b.balance ?? 0))}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="outline" onClick={() => openPayModal(b)} disabled={Number(b.balance ?? 0) <= 0}>
                            <Banknote className="h-4 w-4" />
                            {t('academy.payCommission')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Onglet Vendeurs */}
      {tab === 'sellers' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('academy.sellerProfiles')}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.sellerProfilesSubtitle')}</p>
              </div>
              <Button variant="outline" onClick={loadSellers}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400 dark:border-gray-800">
                    <th className="py-2 pr-3 font-medium">{t('common.user')}</th>
                    <th className="py-2 pr-3 font-medium">{t('academy.kind')}</th>
                    <th className="py-2 pr-3 font-medium">{t('academy.commissionType')}</th>
                    <th className="py-2 pr-3 font-medium">{t('academy.commissionValue')}</th>
                    <th className="py-2 pr-3 font-medium">{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {sellers.map((sp) => (
                    <tr key={sp.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">{sellerLabel(sp)}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {t(`sellerProfiles.kind${sp.kind.charAt(0).toUpperCase()}${sp.kind.slice(1)}`)}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {sp.commission_type === 'none'
                          ? t('academy.commissionNone')
                          : sp.commission_type === 'percent'
                            ? t('academy.commissionPercent')
                            : t('academy.commissionFixed')}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">
                        {sp.commission_type === 'none'
                          ? '—'
                          : sp.commission_type === 'percent'
                            ? `${sp.commission_value}%`
                            : formatCurrency(Number(sp.commission_value))}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sp.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {sp.is_active ? t('common.active') : t('common.inactive')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {/* Modal règle */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editRule ? t('commissions.editRule') : t('commissions.newRule')} maxWidth="max-w-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formErrors.general && <Alert variant="error">{formErrors.general}</Alert>}
          <Input
            label={`${t('commissions.ruleName')} *`}
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            error={formErrors.name}
          />

          <Autocomplete
            label={`${t('academy.courseLabel')} *`}
            value={form.course_id}
            onChange={(id) => setForm((p) => ({ ...p, course_id: id }))}
            fetchOptions={fetchCourses}
            error={formErrors.course_id}
          />

          <Select label={t('commissions.beneficiary')} value={form.beneficiary_type} onChange={(e) => setForm((p) => ({ ...p, beneficiary_type: e.target.value as 'seller_profile' | 'commercial', beneficiary_id: '' }))}>
            <option value="seller_profile">{t('academy.sellerProfile')}</option>
            <option value="commercial">{t('commissions.beneficiaryCommercial')}</option>
          </Select>

          <Autocomplete
            key={`beneficiary-${form.beneficiary_type}`}
            label={`${t('commissions.beneficiary')} *`}
            value={form.beneficiary_id}
            onChange={(id) => setForm((p) => ({ ...p, beneficiary_id: id }))}
            fetchOptions={form.beneficiary_type === 'seller_profile' ? fetchSellerOptions : fetchCommercialOptions}
            error={formErrors.beneficiary_commercial_id || formErrors.beneficiary_seller_profile_id}
          />

          <Select label={t('commissions.formula')} required value={form.formula_type} onChange={(e) => setForm((p) => ({ ...p, formula_type: e.target.value as 'percent' | 'fixed' }))}>
            <option value="percent">{t('commissions.formulaPercent')}</option>
            <option value="fixed">{t('commissions.formulaFixed')}</option>
          </Select>

          {form.formula_type === 'percent' && (
            <Input
              label={`${t('commissions.percentValue')} *`}
              type="number" min={0} max={100} step="0.01" required
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              error={formErrors.percent_value}
            />
          )}
          {form.formula_type === 'fixed' && (
            <Input
              label={`${t('commissions.fixedAmount')} *`}
              type="number" min={0} step="0.01" required
              value={form.value}
              onChange={(e) => setForm((p) => ({ ...p, value: e.target.value }))}
              error={formErrors.fixed_amount}
            />
          )}

          <Select label={t('commissions.trigger')} required value={form.trigger_event} onChange={(e) => setForm((p) => ({ ...p, trigger_event: e.target.value as typeof form.trigger_event }))}>
            {TRIGGERS.map((tr) => (
              <option key={tr} value={tr}>{t(`commissions.trigger_${tr}`)}</option>
            ))}
          </Select>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={submitting} className="flex-1">{editRule ? t('common.save') : t('common.create')}</Button>
          </div>
        </form>
      </Modal>
      {/* Modal versions */}
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
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${v.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {v.is_active ? t('common.active') : t('common.inactive')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Modal>
      {/* Modal paiement */}
      <Modal isOpen={!!payModal} onClose={() => setPayModal(null)} title={t('academy.payCommission')} maxWidth="max-w-md">
        <form onSubmit={handlePay} className="flex flex-col gap-4">
          {payModal && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              <div className="flex items-center justify-between">
                <span className="font-medium">{payModal.name}</span>
                <span className="text-gray-400">{t('academy.balanceLabel')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {payModal.type === 'seller_profile' ? t('academy.sellerProfile') : t('commissions.beneficiaryCommercial')}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatCurrency(selectedBalance(payModal))}</span>
              </div>
            </div>
          )}

          <Select
            label={t('payments.paymentMethod')}
            value={payForm.payment_method}
            onChange={(e) => setPayForm((p) => ({ ...p, payment_method: e.target.value as CommissionPaymentMethod }))}
          >
            {COMMISSION_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === 'especes'
                  ? t('payments.cash')
                  : m === 'orange_money'
                    ? t('payments.orangeMoney')
                    : t('payments.mobileMoney')}
              </option>
            ))}
          </Select>

          <Input
            label={`${t('common.amount')} *`}
            type="number"
            min="0.01"
            max={payModal ? selectedBalance(payModal) || undefined : undefined}
            step="0.01"
            required
            value={payForm.amount}
            onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
          />

          <Input label={t('common.notes')} value={payForm.note} onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} />

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setPayModal(null)} disabled={isPaying} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" isLoading={isPaying} className="flex-1">{t('academy.payCommission')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
