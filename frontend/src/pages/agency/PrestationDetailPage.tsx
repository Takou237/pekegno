import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, MessageSquare, Pencil, Plus, Trash2, Crown, ListChecks } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { activityLogsApi } from '@/api/activityLogs.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import {
  canEditPrestation,
  canManageActions,
  canManageTeam,
  canUpdateActionExecution,
  canValidatePrestation,
} from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ActionStatusBadge, ContractStatusBadge, PrestationStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { RatingSummaryCard, Stars } from '@/components/agencyDept/StarRating';
import { ReasonModal } from '@/components/agencyDept/ReasonModal';
import { SubmitWithProofModal } from '@/components/agencyDept/SubmitWithProofModal';
import { EmployeePicker } from '@/components/agencyDept/Pickers';
import { PrestationFormModal } from '@/components/agencyDept/PrestationFormModal';
import { BudgetBar } from './AgencyDeptDashboardPage';
import {
  ACTION_STATUSES,
  ACTION_TYPES,
  FREQUENCIES,
  STATUSES_REQUIRING_REASON,
  personName,
  type ActionComment,
  type ActionLog,
  type ActionPayload,
  type ClientTeamRole,
  type Prestation,
  type PrestationAction,
  type PrestationStatus,
  type Review,
  type TeamDirectoryMember,
} from '@/types/agencyDepartment';
import type { ActivityLog } from '@/types/activityLog';

type Tab = 'summary' | 'actions' | 'team' | 'reviews' | 'invoices' | 'history';

/** Endpoint de transition correspondant au statut cible. */
const TRANSITION_ENDPOINT: Record<PrestationStatus, Parameters<typeof agencyDeptApi.transition>[1] | null> = {
  draft: 'back-to-draft',
  pending_validation: 'submit',
  validated: 'validate',
  in_progress: 'start',
  completed: 'complete',
  suspended: 'suspend',
  cancelled: 'cancel',
  rejected: 'reject',
};

/** Fiche prestation (§6.4) : résumé + workflow, actions, équipe, notes, factures, historique. */
export default function PrestationDetailPage() {
  const { prestationId } = useParams<{ prestationId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { basePath, agencyId, departmentId } = useAgencyDept();

  const [prestation, setPrestation] = useState<Prestation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('summary');
  const [editOpen, setEditOpen] = useState(false);
  const [reasonFor, setReasonFor] = useState<PrestationStatus | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!prestationId) return;
    agencyDeptApi
      .prestation(prestationId)
      .then(setPrestation)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [prestationId, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function runTransition(target: PrestationStatus, reason?: string) {
    if (!prestation) return;
    const endpoint = target === 'in_progress' && prestation.status === 'suspended' ? 'resume' : TRANSITION_ENDPOINT[target];
    if (!endpoint) return;
    setBusy(true);
    try {
      await agencyDeptApi.transition(prestation.id, endpoint, reason);
      showToast(t('agencyDept.prestations.statusChanged'), 'success');
      setReasonFor(null);
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    } finally {
      setBusy(false);
    }
  }

  function onTransitionClick(target: PrestationStatus) {
    if (target === 'pending_validation') {
      setSubmitOpen(true);
    } else if (STATUSES_REQUIRING_REASON.includes(target)) {
      setReasonFor(target);
    } else {
      runTransition(target);
    }
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!prestation) return <SkeletonDetail />;

  const allowed = (prestation.allowed_transitions ?? []).filter((s) => {
    if (s === 'validated' || s === 'rejected') return canValidatePrestation(user);
    return canEditPrestation(user);
  });

  const tabs: Tab[] = ['summary', 'actions', 'team', 'reviews', 'invoices', 'history'];

  return (
    <div className="flex flex-col gap-6">
      <Link
        to={prestation.offer_id ? `${basePath}/prestations/${prestation.offer_id}/subscriptions` : `${basePath}/prestations`}
        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline dark:text-brand-400"
      >
        <ArrowLeft className="h-4 w-4" />
        {prestation.offer ? prestation.offer.name : t('nav.prestations')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{prestation.name}</h1>
            <PrestationStatusBadge status={prestation.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {prestation.reference} · {personName(prestation.client)}
            {prestation.package && ` · ${t('agencyDept.fromPackage', { name: prestation.package.name })}`}
          </p>
          {prestation.status_reason && (
            <p className="mt-1 text-sm text-orange-600 dark:text-orange-300">{t('agencyDept.reason')} : {prestation.status_reason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPrestation(user) && !['completed', 'cancelled'].includes(prestation.status) && (
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> {t('common.edit')}</Button>
          )}
          {allowed.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={STATUSES_REQUIRING_REASON.includes(s) ? 'outline' : 'primary'}
              onClick={() => onTransitionClick(s)}
              isLoading={busy && reasonFor === null}
            >
              {t(`agencyDept.transition.${prestation.status === 'suspended' && s === 'in_progress' ? 'resume' : s}`)}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${tab === k ? 'border-brand-500 text-brand-600 dark:text-brand-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            {t(`agencyDept.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'summary' && <SummaryTab prestation={prestation} basePath={basePath} />}
      {tab === 'actions' && <ActionsTab prestation={prestation} agencyId={agencyId} onChanged={load} />}
      {tab === 'team' && <TeamTab prestation={prestation} agencyId={agencyId} departmentId={departmentId} />}
      {tab === 'reviews' && <ReviewsTab prestation={prestation} />}
      {tab === 'invoices' && <InvoicesTab prestation={prestation} />}
      {tab === 'history' && <HistoryTab prestationId={prestation.id} />}

      <PrestationFormModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        prestation={prestation}
        agencyId={agencyId}
        departmentId={departmentId}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />

      <ReasonModal
        isOpen={reasonFor !== null}
        title={reasonFor ? t(`agencyDept.transition.${reasonFor}`) : ''}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) => reasonFor && runTransition(reasonFor, reason)}
        isLoading={busy}
      />

      {submitOpen && (
        <SubmitWithProofModal
          prestation={prestation}
          onClose={() => setSubmitOpen(false)}
          onDone={load}
        />
      )}
    </div>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      {title && <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">{title}</h2>}
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-gray-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">{value || '—'}</dd>
    </div>
  );
}

function SummaryTab({ prestation, basePath }: { prestation: Prestation; basePath: string }) {
  const { t } = useTranslation();
  const p = prestation;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card title={t('agencyDept.tabs.summary')}>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label={t('agencyDept.category')} value={p.category?.name} />
            <Field label={t('agencyDept.client')} value={personName(p.client)} />
            <Field label={t('agencyDept.commercial')} value={personName(p.commercial)} />
            <Field label={t('agencyDept.period')} value={`${p.start_date.slice(0, 10)} → ${p.end_date.slice(0, 10)}`} />
            <Field
              label={t('agencyDept.contract')}
              value={p.contract ? (
                <Link to={`${basePath}/contracts/${p.contract.id}`} className="inline-flex items-center gap-2 text-brand-600 hover:underline">
                  {p.contract.number} <ContractStatusBadge status={p.contract.status} />
                </Link>
              ) : t('agencyDept.prestations.noContractYet')}
            />
            <Field
              label={t('agencyDept.prestations.commission')}
              value={p.package_id
                ? t('agencyDept.prestations.commissionFromPackage')
                : p.commission_type
                  ? p.commission_type === 'percent' ? `${Number(p.commission_value)} %` : formatCurrency(p.commission_value)
                  : t('agencyDept.prestations.noCommission')}
            />
            <Field label={t('agencyDept.validatedBy')} value={p.validator ? `${personName(p.validator)} · ${p.validated_at?.slice(0, 10)}` : null} />
          </dl>
          {p.description && <p className="mt-4 whitespace-pre-line text-sm text-gray-600 dark:text-gray-300">{p.description}</p>}
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card title={t('agencyDept.budget.title')}>
          <BudgetBar total={Number(p.budget)} allocated={p.budget_allocated} spent={p.budget_spent} />
          {p.pass_through_budget > 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.budget.passThrough')} : {formatCurrency(p.pass_through_budget)}</p>
          )}
        </Card>
        <Card title={t('agencyDept.rating')}>
          <RatingSummaryCard summary={p.rating_summary} />
        </Card>
      </div>
    </div>
  );
}

const emptyAction: ActionPayload = { title: '', type: 'other', quantity: 1, frequency: 'per_week', budget: 0, is_pass_through: false };

function ActionsTab({ prestation, agencyId, onChanged }: { prestation: Prestation; agencyId?: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { basePath } = useAgencyDept();
  const navigate = useNavigate();
  const [actions, setActions] = useState<PrestationAction[]>([]);
  const [budget, setBudget] = useState({ total: 0, allocated: 0, remaining: 0, spent: 0 });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PrestationAction | null>(null);
  const [form, setForm] = useState<ActionPayload>(emptyAction);
  const [formError, setFormError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PrestationAction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PrestationAction | null>(null);
  const canManage = canManageActions(user);
  const canExecute = canUpdateActionExecution(user);
  const locked = ['completed', 'cancelled'].includes(prestation.status);

  const load = useCallback(() => {
    agencyDeptApi.actions(prestation.id).then((r) => {
      setActions(r.data);
      setBudget(r.budget);
    }).catch(() => {});
  }, [prestation.id]);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(action?: PrestationAction) {
    setEditing(action ?? null);
    setFormError(null);
    setForm(action ? {
      title: action.title, type: action.type, platform: action.platform, quantity: action.quantity, frequency: action.frequency,
      unit: action.unit, budget: Number(action.budget), actual_cost: action.actual_cost ? Number(action.actual_cost) : null,
      is_pass_through: action.is_pass_through, assigned_to: action.assigned_to, start_date: action.start_date?.slice(0, 10) ?? null,
      due_date: action.due_date?.slice(0, 10) ?? null, comment: action.comment,
    } : emptyAction);
    setFormOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = canManage ? form : { actual_cost: form.actual_cost, comment: form.comment };
    try {
      if (editing) await agencyDeptApi.updateAction(editing.id, payload);
      else await agencyDeptApi.createAction(prestation.id, form);
      setFormOpen(false);
      load();
      onChanged();
    } catch (err) {
      setFormError(extractErrorMessage(err, t('common.error')));
    }
  }

  async function changeStatus(action: PrestationAction, status: string) {
    try {
      await agencyDeptApi.actionStatus(action.id, status);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deleteAction(deleteTarget.id);
      setDeleteTarget(null);
      load();
      onChanged();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-64 flex-1"><BudgetBar total={budget.total} allocated={budget.allocated} spent={budget.spent} /></div>
          {canManage && !locked && <Button size="sm" onClick={() => openForm()}><Plus className="h-4 w-4" /> {t('agencyDept.actions.new')}</Button>}
        </div>
      </Card>

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {actions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">{t('agencyDept.actions.empty')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
              <tr>
                <th className="px-4 py-3 font-medium">{t('agencyDept.actions.title')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.actions.rhythm')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.budget.title')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.actions.assignee')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.actions.dueDate')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.actions.progress')}</th>
                <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                <th className="px-4 py-3 font-medium">{t('agencyDept.rating')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {actions.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => navigate(`${basePath}/prestations/${prestation.id}/actions/${a.id}`)}
                  className={`cursor-pointer transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/50 ${a.status === 'cancelled' ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      to={`${basePath}/prestations/${prestation.id}/actions/${a.id}`}
                      className="font-semibold text-gray-900 hover:text-brand-600 hover:underline dark:text-white dark:hover:text-brand-400"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.title}
                    </Link>
                    <p className="text-xs text-gray-400">{t(`agencyDept.actionType.${a.type}`)}{a.platform ? ` · ${a.platform}` : ''}{a.is_pass_through ? ` · ${t('agencyDept.budget.passThroughShort')}` : ''}</p>
                    {a.comment && <p className="mt-1 text-xs italic text-gray-500">« {a.comment} »</p>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{a.quantity} × {t(`agencyDept.frequency.${a.frequency}`)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <p className="text-gray-700 dark:text-gray-200">{formatCurrency(a.budget)}</p>
                    {a.actual_cost && <p className="text-xs text-gray-400">{t('agencyDept.budget.spent')} {formatCurrency(a.actual_cost)}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{personName(a.assignee)}</td>
                  <td className={`px-4 py-3 whitespace-nowrap ${a.is_overdue ? 'font-medium text-red-600' : 'text-gray-600 dark:text-gray-300'}`}>{a.due_date?.slice(0, 10) ?? '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600 dark:text-gray-300">{a.progress ? `${a.progress.done}/${a.progress.expected}` : '—'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    {canExecute && !locked ? (
                      <select
                        value={a.status}
                        onChange={(e) => changeStatus(a, e.target.value)}
                        className="rounded-md border border-gray-200 bg-transparent px-2 py-1 text-xs dark:border-gray-700 dark:text-white"
                      >
                        {ACTION_STATUSES.map((s) => <option key={s} value={s}>{t(`agencyDept.actionStatus.${s}`)}</option>)}
                      </select>
                    ) : (
                      <ActionStatusBadge status={a.status} />
                    )}
                  </td>
                  <td className="px-4 py-3">{a.rating ? <Stars value={a.rating} size="h-3.5 w-3.5" /> : '—'}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <Link to={`${basePath}/prestations/${prestation.id}/actions/${a.id}`}>
                        <Button variant="ghost" size="sm" title="Voir la gestion complète de l'action">
                          <ExternalLink className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setDetail(a)} title={t('agencyDept.actions.followUp')}><MessageSquare className="h-4 w-4" /></Button>
                      {canExecute && !locked && <Button variant="ghost" size="sm" onClick={() => openForm(a)}><Pencil className="h-4 w-4" /></Button>}
                      {canManage && !locked && <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(a)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('agencyDept.actions.edit') : t('agencyDept.actions.new')} maxWidth="max-w-2xl">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {formError && <Alert variant="error">{formError}</Alert>}
          {!editing && <p className="text-xs text-gray-500">{t('agencyDept.actions.budgetHint', { remaining: formatCurrency(budget.remaining) })}</p>}
          <fieldset disabled={!canManage} className="grid gap-3 sm:grid-cols-2">
            <Input label={t('agencyDept.actions.title')} required value={form.title ?? ''} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Select label={t('agencyDept.actions.type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ActionPayload['type'] })}>
              {ACTION_TYPES.map((a) => <option key={a} value={a}>{t(`agencyDept.actionType.${a}`)}</option>)}
            </Select>
            <Input label={t('agencyDept.actions.platform')} value={form.platform ?? ''} onChange={(e) => setForm({ ...form, platform: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <Input label={t('agencyDept.quantity')} type="number" min={1} value={form.quantity ?? 1} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              <Select label={t('agencyDept.actions.frequency')} value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as ActionPayload['frequency'] })}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{t(`agencyDept.frequency.${f}`)}</option>)}
              </Select>
            </div>
            <Input label={t('agencyDept.budget.title')} type="number" min={0} value={form.budget ?? 0} onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })} />
            <EmployeePicker label={t('agencyDept.actions.assignee')} agencyId={agencyId} value={form.assigned_to ?? ''} onChange={(id) => setForm({ ...form, assigned_to: id || null })} />
            <Input label={t('agencyDept.startDate')} type="date" value={form.start_date ?? ''} onChange={(e) => setForm({ ...form, start_date: e.target.value || null })} />
            <Input label={t('agencyDept.actions.dueDate')} type="date" value={form.due_date ?? ''} onChange={(e) => setForm({ ...form, due_date: e.target.value || null })} />
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 dark:text-gray-300">
              <input type="checkbox" checked={!!form.is_pass_through} onChange={(e) => setForm({ ...form, is_pass_through: e.target.checked })} />
              {t('agencyDept.actions.passThrough')}
            </label>
          </fieldset>
          {editing && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label={t('agencyDept.actions.actualCost')} type="number" min={0} value={form.actual_cost ?? ''} onChange={(e) => setForm({ ...form, actual_cost: e.target.value ? Number(e.target.value) : null })} />
              <Input label={t('agencyDept.comment')} value={form.comment ?? ''} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {detail && <ActionFollowUpModal action={detail} canWrite={canExecute && !locked} onClose={() => { setDetail(null); load(); }} />}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('agencyDept.actions.delete')}
        message={deleteTarget?.title ?? ''}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/** Suivi d'une action : commentaires + journal d'exécution (réalisations, preuves, coûts). */
function ActionFollowUpModal({ action, canWrite, onClose }: { action: PrestationAction; canWrite: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [comments, setComments] = useState<ActionComment[]>([]);
  const [logs, setLogs] = useState<ActionLog[]>([]);
  const [progress, setProgress] = useState<{ done: number; expected: number; percent: number } | null>(null);
  const [body, setBody] = useState('');
  const [log, setLog] = useState({ done_at: todayLocal(), quantity_done: '1', proof_url: '', cost: '', note: '' });

  const load = useCallback(() => {
    agencyDeptApi.actionComments(action.id).then(setComments).catch(() => {});
    agencyDeptApi.actionLogs(action.id).then((r) => { setLogs(r.data); setProgress(r.progress); }).catch(() => {});
  }, [action.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function addComment(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await agencyDeptApi.addActionComment(action.id, body.trim());
      setBody('');
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function addLog(e: FormEvent) {
    e.preventDefault();
    try {
      await agencyDeptApi.addActionLog(action.id, {
        done_at: log.done_at,
        quantity_done: Number(log.quantity_done) || 1,
        proof_url: log.proof_url || undefined,
        cost: log.cost ? Number(log.cost) : undefined,
        note: log.note || undefined,
      });
      setLog({ ...log, proof_url: '', cost: '', note: '' });
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={action.title} maxWidth="max-w-3xl">
      <div className="grid max-h-[75vh] gap-6 overflow-y-auto pr-1 md:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><ListChecks className="h-4 w-4" /> {t('agencyDept.actions.logs')}</h3>
          {progress && (
            <div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-green-500" style={{ width: `${progress.percent}%` }} /></div>
              <p className="mt-1 text-xs text-gray-500">{progress.done} / {progress.expected} ({progress.percent} %)</p>
            </div>
          )}
          {canWrite && (
            <form onSubmit={addLog} className="grid gap-2 rounded-lg border border-gray-100 p-3 dark:border-gray-800 sm:grid-cols-2">
              <Input type="date" value={log.done_at} onChange={(e) => setLog({ ...log, done_at: e.target.value })} />
              <Input type="number" min={1} value={log.quantity_done} onChange={(e) => setLog({ ...log, quantity_done: e.target.value })} />
              <Input placeholder={t('agencyDept.actions.proofUrl')} value={log.proof_url} onChange={(e) => setLog({ ...log, proof_url: e.target.value })} />
              <Input placeholder={t('agencyDept.actions.cost')} type="number" min={0} value={log.cost} onChange={(e) => setLog({ ...log, cost: e.target.value })} />
              <Input className="sm:col-span-2" placeholder={t('agencyDept.comment')} value={log.note} onChange={(e) => setLog({ ...log, note: e.target.value })} />
              <Button type="submit" size="sm" className="sm:col-span-2">{t('agencyDept.actions.addLog')}</Button>
            </form>
          )}
          <ul className="flex flex-col gap-2 text-sm">
            {logs.map((l) => (
              <li key={l.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <p className="text-gray-800 dark:text-gray-100">{l.done_at.slice(0, 10)} · ×{l.quantity_done}{l.cost ? ` · ${formatCurrency(l.cost)}` : ''}</p>
                {l.proof_url && <a href={l.proof_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">{l.proof_url}</a>}
                {l.note && <p className="text-xs text-gray-500">{l.note}</p>}
                <p className="text-xs text-gray-400">{personName(l.author)}</p>
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100"><MessageSquare className="h-4 w-4" /> {t('agencyDept.actions.comments')}</h3>
          {canWrite && (
            <form onSubmit={addComment} className="flex gap-2">
              <Input placeholder={t('agencyDept.comment')} value={body} onChange={(e) => setBody(e.target.value)} />
              <Button type="submit" size="sm">{t('common.add')}</Button>
            </form>
          )}
          <ul className="flex flex-col gap-2 text-sm">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <p className="whitespace-pre-line text-gray-800 dark:text-gray-100">{c.body}</p>
                <p className="text-xs text-gray-400">{personName(c.author)} · {c.created_at.slice(0, 16).replace('T', ' ')}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}

function TeamTab({ prestation, agencyId, departmentId }: { prestation: Prestation; agencyId?: string; departmentId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState(prestation.team_members ?? []);
  const [roles, setRoles] = useState<ClientTeamRole[]>([]);
  const [directory, setDirectory] = useState<TeamDirectoryMember[]>([]);
  const [userId, setUserId] = useState('');
  const [directoryId, setDirectoryId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isLead, setIsLead] = useState(false);
  const canManage = canManageTeam(user);

  const load = useCallback(() => {
    agencyDeptApi.team(prestation.id).then(setMembers).catch(() => {});
  }, [prestation.id]);

  useEffect(() => {
    load();
    agencyDeptApi.teamRoles({ department_id: departmentId }).then(setRoles).catch(() => {});
    agencyDeptApi.teamMembers({ agency_id: agencyId, department_id: departmentId, per_page: 100 }).then((r) => setDirectory(r.data)).catch(() => setDirectory([]));
  }, [load, agencyId, departmentId]);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!userId && !directoryId) return;
    try {
      await agencyDeptApi.addTeamMember(prestation.id, {
        user_id: directoryId ? undefined : userId,
        team_member_id: directoryId || undefined,
        client_team_role_id: roleId || null,
        is_lead: isLead,
      });
      setUserId('');
      setDirectoryId('');
      setIsLead(false);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function remove(id: string) {
    try {
      await agencyDeptApi.removeTeamMember(id);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <Card title={t('agencyDept.team.add')}>
          <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 sm:items-end">
            <div className="sm:col-span-2">
              <Select label={t('agencyDept.team.directoryTab')} value={directoryId} onChange={(e) => { setDirectoryId(e.target.value); if (e.target.value) setUserId(''); }}>
                <option value="">—</option>
                {directory.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.first_name} {d.last_name}{d.user_id ? '' : ` · ${t('agencyDept.team.withoutAccount')}`}
                  </option>
                ))}
              </Select>
            </div>
            <EmployeePicker agencyId={agencyId} value={userId} onChange={(id) => { setUserId(id); if (id) setDirectoryId(''); }} />
            <Select label={t('agencyDept.team.role')} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">—</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
            <label className="flex items-center gap-2 pb-2.5 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={isLead} onChange={(e) => setIsLead(e.target.checked)} /> {t('agencyDept.team.lead')}
            </label>
            <Button type="submit" disabled={!userId && !directoryId}><Plus className="h-4 w-4" /> {t('common.add')}</Button>
          </form>
          {roles.length === 0 && <p className="mt-2 text-xs text-gray-500">{t('agencyDept.team.noRolesHint')}</p>}
        </Card>
      )}
      <Card title={t('nav.clientTeam')}>
        {members.length === 0 ? (
          <p className="text-sm text-gray-500">{t('agencyDept.team.empty')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {members.map((m) => {
              const displayName = personName(m.user) !== '—'
                ? personName(m.user)
                : m.team_member
                  ? `${m.team_member.first_name} ${m.team_member.last_name}`.trim() || '—'
                  : '—';
              return (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-gray-900 dark:text-white">
                    {displayName} {m.is_lead && <Crown className="h-4 w-4 text-amber-500" />}
                  </p>
                  <p className="text-xs text-gray-500">{m.team_role?.name ?? '—'} · {m.user?.email ?? ''}</p>
                </div>
                {canManage && <Button variant="ghost" size="sm" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></Button>}
              </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ReviewsTab({ prestation }: { prestation: Prestation }) {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    agencyDeptApi.reviews(prestation.id).then((r) => setReviews(r.data)).catch(() => {});
  }, [prestation.id]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title={t('agencyDept.rating')}>
        <RatingSummaryCard summary={prestation.rating_summary} />
        <p className="mt-3 text-xs text-gray-500">{t('agencyDept.reviews.clientOnly')}</p>
      </Card>
      <div className="lg:col-span-2">
        <Card title={t('agencyDept.reviews.byAction')}>
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-500">{t('agencyDept.reviews.empty')}</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-white">{r.action?.title}</p>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{r.comment}</p>}
                  <p className="mt-1 text-xs text-gray-400">{personName(r.client)} · {r.updated_at.slice(0, 10)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function InvoicesTab({ prestation }: { prestation: Prestation }) {
  const { t } = useTranslation();
  const invoices = prestation.contract?.invoices ?? [];
  if (!prestation.contract) return <Card><p className="text-sm text-gray-500">{t('agencyDept.prestations.noContractYet')}</p></Card>;
  return (
    <Card title={t('nav.invoices')}>
      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500">{t('agencyDept.empty')}</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-gray-400">
            <tr><th className="py-2">N°</th><th>{t('agencyDept.total')}</th><th>{t('agencyDept.paid')}</th><th>{t('agencyDept.balance')}</th><th>{t('common.status')}</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td className="py-2"><Link to={`/invoices/${inv.id}`} className="text-brand-600 hover:underline">{inv.number}</Link></td>
                <td>{formatCurrency(inv.total_amount)}</td>
                <td>{formatCurrency(inv.amount_paid)}</td>
                <td>{formatCurrency(inv.balance_due ?? Number(inv.total_amount) - Number(inv.amount_paid))}</td>
                <td>{t(`invoices.status.${inv.status}`, inv.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function HistoryTab({ prestationId }: { prestationId: string }) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<ActivityLog[] | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    activityLogsApi
      .list({ entity_type: 'prestation', entity_id: prestationId, per_page: 50 })
      .then((r) => setLogs(r.data))
      .catch(() => setForbidden(true));
  }, [prestationId]);

  if (forbidden) return <Card><p className="text-sm text-gray-500">{t('agencyDept.historyForbidden')}</p></Card>;
  if (!logs) return <SkeletonDetail />;

  return (
    <Card title={t('agencyDept.tabs.history')}>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-500">{t('agencyDept.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {logs.map((l) => (
            <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-gray-50 pb-2 dark:border-gray-800">
              <span className="text-gray-700 dark:text-gray-200">{l.description}</span>
              <span className="text-xs text-gray-400">{(l as ActivityLog & { created_at?: string }).created_at?.slice(0, 16).replace('T', ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
