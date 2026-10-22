import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Gift, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { commissionsApi } from '@/api/commissions.api';
import { settingsApi } from '@/api/settings.api';
import { rolesApi } from '@/api/roles.api';
import { usersApi } from '@/api/users.api';
import { servicesApi } from '@/api/services.api';
import { productsApi } from '@/api/products.api';
import { categoriesApi } from '@/api/categories.api';
import { academyApi } from '@/api/academy.api';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/number';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { SkeletonTable } from '@/components/ui/Skeleton';
import type { CommissionType } from '@/types/settings';
import type { RoleListItem } from '@/types/user';
import {
  COMMISSION_BASES,
  type CommissionBasis,
  type CommissionRule,
  type CommissionRulePayload,
  type CommissionTier,
} from '@/types/commissions';

type TargetType = 'none' | 'product' | 'service' | 'course' | 'package' | 'category';
/** Genres : « Produit » vise tous les produits ; un produit précis reste optionnel. */
const TARGET_KINDS = ['product', 'service', 'course', 'package'] as const;
const isKind = (t: TargetType): t is (typeof TARGET_KINDS)[number] => (TARGET_KINDS as readonly string[]).includes(t);

const TARGET_FIELD: Record<Exclude<TargetType, 'none'>, keyof CommissionRule> = {
  product: 'product_id',
  service: 'service_id',
  course: 'course_id',
  package: 'package_id',
  category: 'category_id',
};

interface RuleForm {
  name: string;
  description: string;
  basis: CommissionBasis;
  target_type: TargetType;
  target_id: string;
  target_label: string;
  formula_type: 'percent' | 'fixed';
  percent_value: string;
  fixed_amount: string;
  renewal_number: string;
  renewal_on_time: boolean;
  revenue_scope: 'own' | 'agency';
  min_recovery_rate: string;
  recovery_period: 'previous_month' | 'same_month_last_year';
  growth_multiplier: string;
  max_percent: string;
  bonus_min: string;
  bonus_max: string;
  tiers: CommissionTier[];
  role_ids: string[];
}

const EMPTY_RULE: RuleForm = {
  name: '',
  description: '',
  basis: 'sale',
  target_type: 'none',
  target_id: '',
  target_label: '',
  formula_type: 'percent',
  percent_value: '',
  fixed_amount: '',
  renewal_number: '',
  renewal_on_time: false,
  revenue_scope: 'own',
  min_recovery_rate: '',
  recovery_period: 'previous_month',
  growth_multiplier: '',
  max_percent: '',
  bonus_min: '',
  bonus_max: '',
  tiers: [],
  role_ids: [],
};

/**
 * Modèles tirés de la grille de rémunération : un clic pré-remplit le
 * formulaire, à ajuster (cibles, rôles) avant d'enregistrer.
 */
const TEMPLATES: Array<{ key: string; form: Partial<RuleForm> }> = [
  {
    key: 'commercialTiers',
    form: {
      name: 'Commerciaux — paliers CA mensuel',
      basis: 'monthly_revenue',
      revenue_scope: 'own',
      min_recovery_rate: '80',
      recovery_period: 'previous_month',
      tiers: [
        { min: 1000000, percent: 0.5 },
        { min: 2000000, percent: 1 },
        { min: 3000000, percent: 2 },
        { min: 4000000, percent: 2, fixed_bonus: 50000, bonus_requires_recovery: true },
        { min: 5000000, percent: 3, fixed_bonus: 50000, pot_bonus: 100000, bonus_requires_recovery: true },
      ],
    },
  },
  { key: 'trainerBooks', form: { name: 'Formateurs — 10 % ventes de livres', basis: 'sale', target_type: 'category', formula_type: 'percent', percent_value: '10' } },
  { key: 'trainerUpgrades', form: { name: 'Formateurs — 10 % upgrades', basis: 'upgrade', formula_type: 'percent', percent_value: '10' } },
  { key: 'testimonial', form: { name: 'Prime témoignage', basis: 'manual', bonus_min: '10000', bonus_max: '25000' } },
  { key: 'cmMonthly', form: { name: 'Community managers — 2 % renouvellement mensuel', basis: 'renewal', formula_type: 'percent', percent_value: '2' } },
  { key: 'cmMonth3', form: { name: 'Community managers — 5 % 3e renouvellement', basis: 'renewal', renewal_number: '3', formula_type: 'percent', percent_value: '5' } },
  { key: 'cmMonth6', form: { name: 'Community managers — 10 % 6e renouvellement', basis: 'renewal', renewal_number: '6', formula_type: 'percent', percent_value: '10' } },
  { key: 'cmUpgrades', form: { name: 'Community managers — 10 % upgrades de packages', basis: 'upgrade', formula_type: 'percent', percent_value: '10' } },
  {
    key: 'agencyChiefGrowth',
    form: {
      name: "Chefs d'agence — objectif ×3 vs N-1",
      basis: 'growth',
      revenue_scope: 'agency',
      growth_multiplier: '3',
      max_percent: '2',
      tiers: [
        { min: 3, percent: 1 },
        { min: 4, percent: 1.5 },
        { min: 5, percent: 2 },
      ],
    },
  },
  { key: 'qualityBonus', form: { name: 'Prime qualité / volume (à définir)', basis: 'manual' } },
];

const isPaymentBasis = (basis: CommissionBasis) => basis === 'sale' || basis === 'renewal' || basis === 'upgrade';

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function ruleToForm(rule: CommissionRule): RuleForm {
  const targetType: TargetType = (rule.target_kind as TargetType | null | undefined)
    ?? (Object.keys(TARGET_FIELD) as Array<Exclude<TargetType, 'none'>>).find((k) => rule[TARGET_FIELD[k]])
    ?? 'none';
  const targetLabel = targetType === 'none'
    ? ''
    : ({ product: rule.product?.name, service: rule.service?.name, course: rule.course?.name, package: rule.package?.name, category: rule.category?.name }[targetType] ?? '');
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(Number(v)));

  return {
    name: rule.name,
    description: rule.description ?? '',
    basis: rule.basis ?? 'sale',
    target_type: targetType,
    target_id: targetType === 'none' ? '' : String(rule[TARGET_FIELD[targetType]] ?? ''),
    target_label: targetLabel,
    formula_type: rule.formula_type === 'fixed' ? 'fixed' : 'percent',
    percent_value: str(rule.percent_value),
    fixed_amount: str(rule.fixed_amount),
    renewal_number: str(rule.renewal_number),
    renewal_on_time: Boolean(rule.renewal_on_time),
    revenue_scope: rule.revenue_scope ?? 'own',
    min_recovery_rate: str(rule.min_recovery_rate),
    recovery_period: rule.recovery_period ?? 'previous_month',
    growth_multiplier: str(rule.growth_multiplier),
    max_percent: str(rule.max_percent),
    bonus_min: str(rule.bonus_min),
    bonus_max: str(rule.bonus_max),
    tiers: Array.isArray(rule.tiers_json) ? (rule.tiers_json as CommissionTier[]) : [],
    role_ids: (rule.roles ?? []).map((r) => r.id),
  };
}

function formToPayload(form: RuleForm): CommissionRulePayload {
  const periodic = form.basis === 'monthly_revenue' || form.basis === 'growth';
  const manual = form.basis === 'manual';
  const formula = periodic ? (form.tiers.length > 0 ? 'tiered' : 'percent') : manual ? 'fixed' : form.formula_type;
  const target = {
    target_kind: isKind(form.target_type) ? form.target_type : undefined,
    ...(form.target_type !== 'none' && form.target_id ? { [TARGET_FIELD[form.target_type]]: form.target_id } : {}),
  };

  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    basis: form.basis,
    trigger_event: 'on_payment',
    formula_type: formula,
    percent_value: formula === 'percent' ? toNumber(form.percent_value) : undefined,
    fixed_amount: formula === 'fixed' && !manual ? toNumber(form.fixed_amount) : undefined,
    tiers_json: periodic ? form.tiers : undefined,
    renewal_number: form.basis === 'renewal' ? toNumber(form.renewal_number) : undefined,
    renewal_on_time: form.basis === 'renewal' ? form.renewal_on_time : undefined,
    revenue_scope: periodic ? form.revenue_scope : undefined,
    min_recovery_rate: form.basis === 'monthly_revenue' ? toNumber(form.min_recovery_rate) : undefined,
    recovery_period: form.basis === 'monthly_revenue' ? form.recovery_period : undefined,
    growth_multiplier: form.basis === 'growth' ? toNumber(form.growth_multiplier) : undefined,
    max_percent: form.basis === 'growth' ? toNumber(form.max_percent) : undefined,
    bonus_min: manual ? toNumber(form.bonus_min) : undefined,
    bonus_max: manual ? toNumber(form.bonus_max) : undefined,
    role_ids: form.role_ids,
    ...(isPaymentBasis(form.basis) ? target : {}),
  };
}

export function CommissionSettingsTab() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'rules' | 'roles'>('rules');

  const [ruleModal, setRuleModal] = useState<{ open: boolean; editing: CommissionRule | null }>({ open: false, editing: null });
  const [form, setForm] = useState<RuleForm>(EMPTY_RULE);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<CommissionRule | null>(null);

  const [awardRule, setAwardRule] = useState<CommissionRule | null>(null);
  const [award, setAward] = useState({ user_id: '', amount: '', label: '' });

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ruleList, roleList] = await Promise.all([commissionsApi.listRules(), rolesApi.list()]);
      // Règles par rôle : celles qui portent une assiette (les anciennes règles
      // par service/package restent gérées depuis leurs écrans).
      // Dernière version de chaque règle, actives d'abord ; une règle inactive
      // (ex. « à définir ») se réactive en l'enregistrant.
      setRules([...ruleList].sort((a, b) => Number(b.is_active) - Number(a.is_active)));
      setRoles(roleList.filter((r) => r.name !== 'client' && r.name !== 'super-admin'));
    } catch (error) {
      showToast(extractErrorMessage(error, t('commissionRules.loadFailed')), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { void load(); }, [load]);

  function openCreate(template?: Partial<RuleForm>) {
    setForm({ ...EMPTY_RULE, ...template, tiers: template?.tiers ? [...template.tiers] : [] });
    setFormErrors({});
    setRuleModal({ open: true, editing: null });
  }

  function openEdit(rule: CommissionRule) {
    setForm(ruleToForm(rule));
    setFormErrors({});
    setRuleModal({ open: true, editing: rule });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (form.role_ids.length === 0) {
      setFormErrors({ role_ids: t('commissionRules.rolesRequired') });
      return;
    }
    if (form.target_type === 'category' && !form.target_id) {
      setFormErrors({ category_id: t('commissionRules.categoryRequired') });
      return;
    }
    setSaving(true);
    setFormErrors({});
    try {
      const payload = formToPayload(form);
      if (ruleModal.editing) {
        await commissionsApi.updateRule(ruleModal.editing.id, payload);
      } else {
        await commissionsApi.createRule(payload);
      }
      showToast(t(ruleModal.editing ? 'commissionRules.updated' : 'commissionRules.created'), 'success');
      setRuleModal({ open: false, editing: null });
      void load();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('commissionRules.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await commissionsApi.deactivateRule(deactivateTarget.id);
      showToast(t('commissionRules.deactivated'), 'success');
      setDeactivateTarget(null);
      void load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('commissionRules.saveFailed')), 'error');
    }
  }

  async function handleAward(event: FormEvent) {
    event.preventDefault();
    if (!awardRule) return;
    try {
      await commissionsApi.awardManual(awardRule.id, {
        user_id: award.user_id,
        amount: Number(award.amount),
        label: award.label.trim() || undefined,
      });
      showToast(t('commissionRules.awarded'), 'success');
      setAwardRule(null);
    } catch (error) {
      showToast(extractErrorMessage(error, t('commissionRules.saveFailed')), 'error');
    }
  }

  async function toggleRoleRule(role: RoleListItem, rule: CommissionRule, checked: boolean) {
    const current = rules.filter((r) => r.roles?.some((x) => x.id === role.id)).map((r) => r.rule_group_id);
    const next = checked ? [...new Set([...current, rule.rule_group_id])] : current.filter((g) => g !== rule.rule_group_id);
    try {
      await commissionsApi.syncRoleRules(role.id, next);
      setRules((prev) =>
        prev.map((r) => {
          if (r.rule_group_id !== rule.rule_group_id) return r;
          const others = (r.roles ?? []).filter((x) => x.id !== role.id);
          return { ...r, roles: checked ? [...others, { id: role.id, name: role.name }] : others };
        }),
      );
    } catch (error) {
      showToast(extractErrorMessage(error, t('commissionRules.saveFailed')), 'error');
    }
  }

  function describeRule(rule: CommissionRule): string {
    const basis = rule.basis ?? 'sale';
    if (basis === 'manual') {
      const min = rule.bonus_min != null ? formatCurrency(Number(rule.bonus_min)) : '—';
      const max = rule.bonus_max != null ? formatCurrency(Number(rule.bonus_max)) : '—';
      return t('commissionRules.manualRange', { min, max });
    }
    if (rule.formula_type === 'tiered') {
      return t('commissionRules.tiersCount', { count: Array.isArray(rule.tiers_json) ? rule.tiers_json.length : 0 });
    }
    if (rule.formula_type === 'fixed') return formatCurrency(Number(rule.fixed_amount ?? 0));
    return `${Number(rule.percent_value ?? 0)} %`;
  }

  function targetLabel(rule: CommissionRule): string {
    const name = rule.product?.name ?? rule.service?.name ?? rule.course?.name ?? rule.package?.name ?? rule.category?.name
      ?? (rule.target_kind ? t(`commissionRules.target_${rule.target_kind}`) : undefined);
    if (rule.basis === 'renewal') {
      const which = rule.renewal_number
        ? t('commissionRules.renewalNumberLabel', { number: rule.renewal_number })
        : t('commissionRules.everyRenewal');
      const onTime = rule.renewal_on_time ? ` · ${t('commissionRules.onTime')}` : '';
      return which + onTime + (name ? ` · ${name}` : '');
    }
    return name ?? t('commissionRules.allSales');
  }

  if (isLoading) return <SkeletonTable rows={5} />;

  return (
    <div className="flex flex-col gap-6">
      <DefaultCommissionCard />
      <MonthlyBonusCard />

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('commissionRules.title')}</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissionRules.subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value="" onChange={(e) => { const tpl = TEMPLATES.find((x) => x.key === e.target.value); if (tpl) openCreate(tpl.form); }}>
              <option value="">{t('commissionRules.fromTemplate')}</option>
              {TEMPLATES.map((tpl) => (
                <option key={tpl.key} value={tpl.key}>{tpl.form.name}</option>
              ))}
            </Select>
            <Button onClick={() => openCreate()}><Plus className="h-4 w-4" />{t('commissionRules.newRule')}</Button>
          </div>
        </div>

        <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700 sm:w-fit">
          {(['rules', 'roles'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${view === key ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {t(`commissionRules.view_${key}`)}
            </button>
          ))}
        </div>

        {view === 'rules' ? (
          rules.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{t('commissionRules.empty')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{t('commissionRules.name')}</th>
                    <th className="py-2 pr-3 font-medium">{t('commissionRules.basis')}</th>
                    <th className="py-2 pr-3 font-medium">{t('commissionRules.target')}</th>
                    <th className="py-2 pr-3 font-medium">{t('commissionRules.amount')}</th>
                    <th className="py-2 pr-3 font-medium">{t('commissionRules.roles')}</th>
                    <th className="py-2 text-right font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rules.map((rule) => (
                    <tr key={rule.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800 dark:text-gray-100">
                        {rule.name}
                        {!rule.is_active && <span className="ml-2"><Badge variant="neutral">{t('commissionRules.inactive')}</Badge></span>}
                        {rule.description && <p className="text-xs font-normal text-gray-400">{rule.description}</p>}
                      </td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{t(`commissionRules.basis_${rule.basis ?? 'sale'}`)}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{targetLabel(rule)}</td>
                      <td className="py-2 pr-3 text-gray-600 dark:text-gray-300">{describeRule(rule)}</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-1">
                          {(rule.roles ?? []).length === 0
                            ? <span className="text-xs text-gray-400">{t('commissionRules.noRole')}</span>
                            : rule.roles!.map((r) => <Badge key={r.id} variant="neutral">{r.name}</Badge>)}
                        </div>
                      </td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {rule.basis === 'manual' && rule.is_active && (
                            <button type="button" onClick={() => { setAward({ user_id: '', amount: '', label: '' }); setAwardRule(rule); }} className="rounded p-1 text-brand-500 hover:bg-brand-50" title={t('commissionRules.award')}>
                              <Gift className="h-4 w-4" />
                            </button>
                          )}
                          <button type="button" onClick={() => openEdit(rule)} className="rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800" title={t('common.edit')}>
                            <Pencil className="h-4 w-4" />
                          </button>
                          {rule.is_active && (
                            <button type="button" onClick={() => setDeactivateTarget(rule)} className="rounded p-1 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20" title={t('common.delete')}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {roles.map((role) => (
              <div key={role.id} className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
                <p className="mb-2 font-semibold text-gray-800 dark:text-gray-100">{role.name}</p>
                {rules.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('commissionRules.empty')}</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {rules.map((rule) => (
                      <label key={rule.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300"
                          checked={rule.roles?.some((r) => r.id === role.id) ?? false}
                          onChange={(e) => void toggleRoleRule(role, rule, e.target.checked)}
                        />
                        <span>{rule.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={ruleModal.open}
        onClose={() => setRuleModal({ open: false, editing: null })}
        title={ruleModal.editing ? t('commissionRules.editRule') : t('commissionRules.newRule')}
        maxWidth="max-w-2xl"
      >
        <RuleFormFields form={form} setForm={setForm} roles={roles} errors={formErrors} onSubmit={handleSave} saving={saving} onCancel={() => setRuleModal({ open: false, editing: null })} />
      </Modal>

      <Modal isOpen={awardRule !== null} onClose={() => setAwardRule(null)} title={t('commissionRules.awardTitle', { name: awardRule?.name ?? '' })} maxWidth="max-w-md">
        <form onSubmit={handleAward} className="flex flex-col gap-4">
          <Autocomplete
            label={t('commissionRules.beneficiary')}
            placeholder={t('commissionRules.beneficiaryPlaceholder')}
            value={award.user_id}
            onChange={(id) => setAward((p) => ({ ...p, user_id: id }))}
            fetchOptions={async (query) => {
              const lists = await Promise.all(
                (awardRule?.roles ?? []).map((r) => usersApi.list({ search: query.trim() || undefined, role_id: r.id, per_page: 20 })),
              );
              return lists.flatMap((l) => l.data).map((u) => ({
                id: u.id,
                label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username,
                subtitle: u.role?.name ?? '',
              }));
            }}
          />
          <Input
            label={t('commissionRules.awardAmount')}
            type="number"
            min={awardRule?.bonus_min != null ? Number(awardRule.bonus_min) : 0}
            max={awardRule?.bonus_max != null ? Number(awardRule.bonus_max) : undefined}
            required
            value={award.amount}
            onChange={(e) => setAward((p) => ({ ...p, amount: e.target.value }))}
          />
          <Input label={t('commissionRules.awardLabel')} value={award.label} onChange={(e) => setAward((p) => ({ ...p, label: e.target.value }))} />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setAwardRule(null)} className="flex-1">{t('common.cancel')}</Button>
            <Button type="submit" disabled={!award.user_id || !award.amount} className="flex-1">{t('commissionRules.award')}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={deactivateTarget !== null}
        title={t('commissionRules.deactivateTitle')}
        message={t('commissionRules.deactivateMessage', { name: deactivateTarget?.name ?? '' })}
        confirmLabel={t('commissionRules.deactivate')}
        variant="danger"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />
    </div>
  );
}

function RuleFormFields({
  form,
  setForm,
  roles,
  errors,
  onSubmit,
  onCancel,
  saving,
}: {
  form: RuleForm;
  setForm: React.Dispatch<React.SetStateAction<RuleForm>>;
  roles: RoleListItem[];
  errors: Record<string, string>;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof RuleForm>(key: K, value: RuleForm[K]) => setForm((p) => ({ ...p, [key]: value }));
  const periodic = form.basis === 'monthly_revenue' || form.basis === 'growth';
  const tierUnit = form.basis === 'growth' ? t('commissionRules.tierRatio') : t('commissionRules.tierRevenue');

  const fetchTargets = useMemo(() => async (query: string) => {
    const q = query.trim();
    switch (form.target_type) {
      case 'product':
        return (await productsApi.search(q)).map((p) => ({ id: p.id, label: p.name }));
      case 'service':
        return (await servicesApi.search(q)).map((s) => ({ id: s.id, label: s.name }));
      case 'course':
        return (await academyApi.courses({ search: q || undefined, per_page: 20 })).data.map((c) => ({ id: c.id, label: c.name }));
      case 'package':
        return (await agencyDeptApi.packages({ search: q || undefined, per_page: 20 })).map((p) => ({ id: p.id, label: p.name }));
      case 'category':
        return (await categoriesApi.list({ search: q || undefined, per_page: 50 })).data.map((c) => ({ id: c.id, label: c.name }));
      default:
        return [];
    }
  }, [form.target_type]);

  function updateTier(index: number, patch: Partial<CommissionTier>) {
    setForm((p) => ({ ...p, tiers: p.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)) }));
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {Object.keys(errors).length > 0 && <Alert variant="error">{Object.values(errors).join(' ')}</Alert>}

      <Input label={t('commissionRules.name')} required value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select label={t('commissionRules.basis')} value={form.basis} onChange={(e) => set('basis', e.target.value as CommissionBasis)}>
          {COMMISSION_BASES.map((b) => <option key={b} value={b}>{t(`commissionRules.basis_${b}`)}</option>)}
        </Select>
        {form.basis === 'renewal' && (
          <div className="flex flex-col gap-2">
            <Input
              label={t('commissionRules.renewalNumber')}
              hint={t('commissionRules.renewalNumberHint')}
              type="number"
              min={1}
              value={form.renewal_number}
              onChange={(e) => set('renewal_number', e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.renewal_on_time}
                onChange={(e) => set('renewal_on_time', e.target.checked)}
              />
              {t('commissionRules.renewalOnTime')}
            </label>
          </div>
        )}
        {periodic && (
          <Select label={t('commissionRules.revenueScope')} value={form.revenue_scope} onChange={(e) => set('revenue_scope', e.target.value as RuleForm['revenue_scope'])}>
            <option value="own">{t('commissionRules.scope_own')}</option>
            <option value="agency">{t('commissionRules.scope_agency')}</option>
          </Select>
        )}
      </div>
      <p className="-mt-2 text-xs text-gray-400">{t(`commissionRules.basisHint_${form.basis}`)}</p>

      {isPaymentBasis(form.basis) && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('commissionRules.targetType')}
              value={form.target_type}
              onChange={(e) => setForm((p) => ({ ...p, target_type: e.target.value as TargetType, target_id: '', target_label: '' }))}
            >
              {(['none', 'product', 'service', 'course', 'package', 'category'] as const).map((k) => (
                <option key={k} value={k}>{t(`commissionRules.target_${k}`)}</option>
              ))}
            </Select>
            {form.target_type !== 'none' && (
              <Autocomplete
                key={form.target_type}
                label={isKind(form.target_type) ? t(`commissionRules.targetOne_${form.target_type}`) : t(`commissionRules.target_${form.target_type}`)}
                placeholder={isKind(form.target_type) ? t('commissionRules.targetAllPlaceholder') : t('commissionRules.targetPlaceholder')}
                value={form.target_id}
                selectedOption={form.target_id ? { id: form.target_id, label: form.target_label } : null}
                onChange={(id) => set('target_id', id)}
                fetchOptions={fetchTargets}
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label={t('commissionRules.formula')} value={form.formula_type} onChange={(e) => set('formula_type', e.target.value as RuleForm['formula_type'])}>
              <option value="percent">{t('commissionRules.formula_percent')}</option>
              <option value="fixed">{t('commissionRules.formula_fixed')}</option>
            </Select>
            {form.formula_type === 'percent' ? (
              <Input label={t('commissionRules.percentValue')} type="number" min={0} max={100} step="0.01" required value={form.percent_value} onChange={(e) => set('percent_value', e.target.value)} error={errors.percent_value} />
            ) : (
              <Input label={t('commissionRules.fixedAmount')} type="number" min={0} step="1" required value={form.fixed_amount} onChange={(e) => set('fixed_amount', e.target.value)} error={errors.fixed_amount} />
            )}
          </div>
          <p className="-mt-2 text-xs text-gray-400">{t('commissionRules.promoHint')}</p>
        </>
      )}

      {periodic && (
        <div className="flex flex-col gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('commissionRules.tiers')}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => set('tiers', [...form.tiers, { min: 0, percent: 0 }])}>
              <Plus className="h-4 w-4" />{t('commissionRules.addTier')}
            </Button>
          </div>
          {form.tiers.length === 0 && form.basis === 'growth' && (
            <Input label={t('commissionRules.percentValue')} type="number" min={0} max={100} step="0.01" value={form.percent_value} onChange={(e) => set('percent_value', e.target.value)} />
          )}
          {form.tiers.map((tier, index) => (
            <div key={index} className="grid grid-cols-2 items-end gap-2 sm:grid-cols-6">
              <Input label={index === 0 ? tierUnit : undefined} type="number" min={0} step="any" value={String(tier.min)} onChange={(e) => updateTier(index, { min: Number(e.target.value) })} />
              <Input label={index === 0 ? '%' : undefined} type="number" min={0} max={100} step="0.01" value={String(tier.percent)} onChange={(e) => updateTier(index, { percent: Number(e.target.value) })} />
              {form.basis === 'monthly_revenue' && (
                <>
                  <Input label={index === 0 ? t('commissionRules.fixedBonus') : undefined} type="number" min={0} value={String(tier.fixed_bonus ?? '')} onChange={(e) => updateTier(index, { fixed_bonus: Number(e.target.value) || undefined })} />
                  <Input label={index === 0 ? t('commissionRules.potBonus') : undefined} type="number" min={0} value={String(tier.pot_bonus ?? '')} onChange={(e) => updateTier(index, { pot_bonus: Number(e.target.value) || undefined })} />
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={Boolean(tier.bonus_requires_recovery)} onChange={(e) => updateTier(index, { bonus_requires_recovery: e.target.checked })} />
                    {t('commissionRules.bonusRequiresRecovery')}
                  </label>
                </>
              )}
              <button type="button" onClick={() => set('tiers', form.tiers.filter((_, i) => i !== index))} className="mb-2 justify-self-end rounded p-1 text-red-400 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {form.basis === 'monthly_revenue' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('commissionRules.minRecovery')} type="number" min={0} max={100} value={form.min_recovery_rate} onChange={(e) => set('min_recovery_rate', e.target.value)} />
              <Select label={t('commissionRules.recoveryPeriod')} value={form.recovery_period} onChange={(e) => set('recovery_period', e.target.value as RuleForm['recovery_period'])}>
                <option value="previous_month">{t('commissionRules.recovery_previous_month')}</option>
                <option value="same_month_last_year">{t('commissionRules.recovery_same_month_last_year')}</option>
              </Select>
            </div>
          )}
          {form.basis === 'growth' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label={t('commissionRules.growthMultiplier')} type="number" min={0} step="0.1" value={form.growth_multiplier} onChange={(e) => set('growth_multiplier', e.target.value)} />
              <Input label={t('commissionRules.maxPercent')} type="number" min={0} max={100} step="0.01" value={form.max_percent} onChange={(e) => set('max_percent', e.target.value)} />
            </div>
          )}
        </div>
      )}

      {form.basis === 'manual' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={t('commissionRules.bonusMin')} type="number" min={0} value={form.bonus_min} onChange={(e) => set('bonus_min', e.target.value)} />
          <Input label={t('commissionRules.bonusMax')} type="number" min={0} value={form.bonus_max} onChange={(e) => set('bonus_max', e.target.value)} error={errors.bonus_max} />
        </div>
      )}

      <div>
        <span className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('commissionRules.roles')} *</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {roles.map((role) => (
            <label key={role.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={form.role_ids.includes(role.id)}
                onChange={(e) => set('role_ids', e.target.checked ? [...form.role_ids, role.id] : form.role_ids.filter((id) => id !== role.id))}
              />
              {role.name}
            </label>
          ))}
        </div>
        {errors.role_ids && <p className="mt-1 text-sm text-error-500">{errors.role_ids}</p>}
      </div>

      <Input label={t('commissionRules.description')} value={form.description} onChange={(e) => set('description', e.target.value)} />

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">{t('common.cancel')}</Button>
        <Button type="submit" isLoading={saving} className="flex-1"><Save className="h-4 w-4" />{t('common.save')}</Button>
      </div>
    </form>
  );
}

/** Mois précédent au format AAAA-MM. */
function previousMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Primes calculées sur le total d'un mois (paliers de CA des commerciaux,
 * objectif des chefs d'agence) : le super-admin les lance en début de mois
 * pour le mois écoulé. Relançable sans doublon.
 */
function MonthlyBonusCard() {
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [period, setPeriod] = useState(previousMonth);
  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number } | null>(null);

  if (user?.role?.name !== 'super-admin') return null;

  const monthLabel = period
    ? new Date(`${period}-01T00:00:00`).toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })
    : '';

  async function handleCompute() {
    setComputing(true);
    setResult(null);
    try {
      const data = await commissionsApi.computePeriod(period);
      setResult({ created: data.created, updated: data.updated });
      showToast(t('commissionRules.computeDone', { created: data.created, updated: data.updated }), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('commissionRules.computeFailed')), 'error');
    } finally {
      setComputing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('commissionRules.computeTitle')}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissionRules.computeHint')}</p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Input label={t('commissionRules.period')} type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setResult(null); }} />
        <Button onClick={handleCompute} isLoading={computing} disabled={!period}>
          <Calculator className="h-4 w-4" />
          {t('commissionRules.computeFor', { month: monthLabel })}
        </Button>
      </div>
      {result && (
        <p className="mt-3 text-sm text-success-600">{t('commissionRules.computeDone', result)}</p>
      )}
    </div>
  );
}

/** Commission par défaut du réseau (déplacée depuis l'onglet Général). */
function DefaultCommissionCard() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [type, setType] = useState<CommissionType>('percent');
  const [value, setValue] = useState('20');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    settingsApi.list().then((settings) => {
      const map = new Map(settings.map((s) => [s.key, s.value]));
      const rawType = map.get('default_commission_type') as CommissionType | undefined;
      const rawValue = map.get('default_commission_value');
      const isLegacyDefault = (rawType === undefined || rawType === 'none') && (rawValue === undefined || Number(rawValue) === 0);
      setType(isLegacyDefault ? 'percent' : (rawType ?? 'percent'));
      setValue(String(isLegacyDefault ? 20 : (rawValue ?? 20)));
    }).catch(() => {});
  }, []);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await settingsApi.update({ default_commission_type: type, default_commission_value: Number(value) });
      showToast(t('settingsPage.saved'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('settingsPage.saveFailed')), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">{t('settingsPage.commission')}</h2>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('commissionRules.defaultHint')}</p>
      <div className="mt-4 grid items-end gap-4 sm:grid-cols-3">
        <Select label={t('settingsPage.defaultCommissionType')} value={type} onChange={(e) => setType(e.target.value as CommissionType)}>
          <option value="none">{t('settingsPage.commissionNone')}</option>
          <option value="percent">{t('settingsPage.commissionPercent')}</option>
          <option value="fixed">{t('settingsPage.commissionFixed')}</option>
        </Select>
        <Input label={t('settingsPage.defaultCommissionValue')} type="number" min="0" step="0.01" required value={value} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" isLoading={saving}><Save className="h-4 w-4" />{t('common.save')}</Button>
      </div>
    </form>
  );
}
