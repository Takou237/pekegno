import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  User,
  AlertCircle,
  Coins,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAgencyDept } from '@/hooks/useAgencyDept';
import { formatCurrency } from '@/utils/number';
import { todayLocal } from '@/utils/date';
import { canManageActions, canUpdateActionExecution } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ActionStatusBadge } from '@/components/agencyDept/AgencyBadges';
import { EmployeePicker } from '@/components/agencyDept/Pickers';
import {
  ACTION_STATUSES,
  ACTION_TYPES,
  FREQUENCIES,
  personName,
  type ActionComment,
  type ActionPayload,
  type PrestationAction,
  type PrestationActionExecution,
  type WeekSummary,
} from '@/types/agencyDepartment';

export default function PrestationActionDetailPage() {
  const { prestationId, actionId } = useParams<{ prestationId: string; actionId: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { basePath, agencyId } = useAgencyDept();

  const [action, setAction] = useState<PrestationAction | null>(null);
  const [executions, setExecutions] = useState<PrestationActionExecution[]>([]);
  const [weeks, setWeeks] = useState<WeekSummary[]>([]);
  const [progress, setProgress] = useState<{ done: number; expected: number; percent: number }>({
    done: 0,
    expected: 0,
    percent: 0,
  });
  const [comments, setComments] = useState<ActionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWeek, setSelectedWeek] = useState<number | 'all' | 'current'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'todo' | 'done' | 'overdue'>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [completeModalTarget, setCompleteModalTarget] = useState<PrestationActionExecution | null>(null);
  const [completeForm, setCompleteForm] = useState({
    done_at: todayLocal(),
    proof_url: '',
    actual_cost: '',
    note: '',
  });
  const [completeSubmitting, setCompleteSubmitting] = useState(false);

  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    week_number: 1,
    title: '',
    scheduled_date: todayLocal(),
    status: 'todo' as 'todo' | 'done',
    proof_url: '',
    actual_cost: '',
    note: '',
    assigned_to: '',
  });
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [editActionOpen, setEditActionOpen] = useState(false);
  const [actionForm, setActionForm] = useState<ActionPayload>({
    title: '',
    type: 'other',
    quantity: 1,
    frequency: 'per_week',
    budget: 0,
  });

  const [deleteTarget, setDeleteTarget] = useState<PrestationActionExecution | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // Collapsed state of weeks
  const [collapsedWeeks, setCollapsedWeeks] = useState<Record<number, boolean>>({});

  const canManage = canManageActions(user);
  const canExecute = canUpdateActionExecution(user);

  const loadData = useCallback(async () => {
    if (!prestationId || !actionId) return;
    try {
      const [detailRes, execRes, commentsRes] = await Promise.all([
        agencyDeptApi.actionDetail(prestationId, actionId),
        agencyDeptApi.actionExecutions(actionId),
        agencyDeptApi.actionComments(actionId).catch(() => []),
      ]);

      setAction(detailRes.action);
      setProgress(detailRes.progress);
      setWeeks(detailRes.weeks);
      setExecutions(execRes.data);
      setComments(commentsRes);

      // Pre-fill manual form with latest week or current week
      const currentW = detailRes.weeks.find((w) => w.is_current);
      if (currentW) {
        setManualForm((prev) => ({ ...prev, week_number: currentW.week_number }));
      } else if (detailRes.weeks.length > 0) {
        setManualForm((prev) => ({ ...prev, week_number: detailRes.weeks[0].week_number }));
      }
    } catch (e) {
      setError(extractErrorMessage(e, t('common.error')));
    } finally {
      setLoading(false);
    }
  }, [prestationId, actionId, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle global action status change
  async function handleActionStatusChange(newStatus: string) {
    if (!action) return;
    try {
      await agencyDeptApi.actionStatus(action.id, newStatus);
      showToast(t('agencyDept.prestations.statusChanged'), 'success');
      loadData();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  }

  // Open complete execution modal
  function openCompleteModal(exec: PrestationActionExecution) {
    setCompleteModalTarget(exec);
    setCompleteForm({
      done_at: exec.done_at ? exec.done_at.slice(0, 10) : todayLocal(),
      proof_url: exec.proof_url ?? '',
      actual_cost: exec.actual_cost ? String(exec.actual_cost) : '',
      note: exec.note ?? '',
    });
  }

  // Submit complete execution
  async function handleCompleteSubmit(e: FormEvent) {
    e.preventDefault();
    if (!completeModalTarget) return;
    setCompleteSubmitting(true);
    try {
      await agencyDeptApi.updateExecution(completeModalTarget.id, {
        status: 'done',
        done_at: completeForm.done_at,
        proof_url: completeForm.proof_url.trim() || null,
        actual_cost: completeForm.actual_cost ? Number(completeForm.actual_cost) : null,
        note: completeForm.note.trim() || null,
      });
      showToast('Exécution enregistrée avec succès', 'success');
      setCompleteModalTarget(null);
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    } finally {
      setCompleteSubmitting(false);
    }
  }

  // Reopen an execution (set back to todo)
  async function handleReopenExecution(exec: PrestationActionExecution) {
    try {
      await agencyDeptApi.updateExecution(exec.id, {
        status: 'todo',
        done_at: null,
      });
      showToast('Exécution rouverte', 'success');
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  // Submit manual execution
  async function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    setManualSubmitting(true);
    try {
      await agencyDeptApi.createExecution(action.id, {
        week_number: Number(manualForm.week_number) || 1,
        title: manualForm.title.trim() || undefined,
        scheduled_date: manualForm.scheduled_date || undefined,
        status: manualForm.status,
        done_at: manualForm.status === 'done' ? manualForm.scheduled_date : undefined,
        proof_url: manualForm.status === 'done' ? manualForm.proof_url.trim() || null : null,
        actual_cost: manualForm.actual_cost ? Number(manualForm.actual_cost) : null,
        note: manualForm.note.trim() || null,
        assigned_to: manualForm.assigned_to || null,
      });
      showToast('Exécution manuelle ajoutée avec succès', 'success');
      setManualModalOpen(false);
      setManualForm({
        week_number: manualForm.week_number,
        title: '',
        scheduled_date: todayLocal(),
        status: 'todo',
        proof_url: '',
        actual_cost: '',
        note: '',
        assigned_to: '',
      });
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    } finally {
      setManualSubmitting(false);
    }
  }

  // Delete manual execution
  async function handleDeleteExecution() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deleteExecution(deleteTarget.id);
      showToast('Exécution supprimée', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  // Open edit action modal
  function openEditAction() {
    if (!action) return;
    setActionForm({
      title: action.title,
      type: action.type,
      platform: action.platform,
      quantity: action.quantity,
      frequency: action.frequency,
      unit: action.unit,
      budget: Number(action.budget),
      actual_cost: action.actual_cost ? Number(action.actual_cost) : null,
      is_pass_through: action.is_pass_through,
      assigned_to: action.assigned_to,
      start_date: action.start_date?.slice(0, 10) ?? null,
      due_date: action.due_date?.slice(0, 10) ?? null,
      comment: action.comment,
    });
    setEditActionOpen(true);
  }

  // Save edit action
  async function handleSaveAction(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    try {
      await agencyDeptApi.updateAction(action.id, actionForm);
      showToast('Action mise à jour', 'success');
      setEditActionOpen(false);
      loadData();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  // Add comment
  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!action || !commentBody.trim()) return;
    setCommentSubmitting(true);
    try {
      await agencyDeptApi.addActionComment(action.id, commentBody.trim());
      setCommentBody('');
      const updated = await agencyDeptApi.actionComments(action.id);
      setComments(updated);
      showToast('Commentaire ajouté', 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    } finally {
      setCommentSubmitting(false);
    }
  }

  // Filtered executions
  const filteredExecutions = useMemo(() => {
    return executions.filter((item) => {
      // Week filter
      if (selectedWeek === 'current') {
        const cur = weeks.find((w) => w.is_current);
        if (cur && item.week_number !== cur.week_number) return false;
      } else if (typeof selectedWeek === 'number' && item.week_number !== selectedWeek) {
        return false;
      }

      // Status filter
      if (statusFilter === 'todo' && item.status !== 'todo' && item.status !== 'in_progress') return false;
      if (statusFilter === 'done' && item.status !== 'done') return false;
      if (statusFilter === 'overdue' && !item.is_overdue) return false;

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(q);
        const matchNote = item.note?.toLowerCase().includes(q);
        const matchProof = item.proof_url?.toLowerCase().includes(q);
        if (!matchTitle && !matchNote && !matchProof) return false;
      }

      return true;
    });
  }, [executions, selectedWeek, statusFilter, search, weeks]);

  // Group filtered executions by week_number
  const executionsByWeek = useMemo(() => {
    const map = new Map<number, PrestationActionExecution[]>();
    for (const exec of filteredExecutions) {
      const arr = map.get(exec.week_number) ?? [];
      arr.push(exec);
      map.set(exec.week_number, arr);
    }
    return map;
  }, [filteredExecutions]);

  const toggleWeekCollapse = (weekNum: number) => {
    setCollapsedWeeks((prev) => ({ ...prev, [weekNum]: !prev[weekNum] }));
  };

  if (loading) return <SkeletonDetail />;
  if (error || !action) return <Alert variant="error">{error || 'Action introuvable'}</Alert>;

  const currentWeek = weeks.find((w) => w.is_current);
  const totalCost = Number(action.actual_cost ?? 0);
  const totalBudget = Number(action.budget ?? 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <Link
          to={`${basePath}/prestations`}
          className="inline-flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400"
        >
          <ArrowLeft className="h-4 w-4" /> {t('nav.prestations')}
        </Link>
        <span>/</span>
        <Link
          to={`${basePath}/prestations/${prestationId}`}
          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
        >
          {action.prestation?.name || 'Prestation'}
        </Link>
        <span>/</span>
        <span className="font-semibold text-gray-900 dark:text-white">{action.title}</span>
      </div>

      {/* Hero Header Card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-64 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{action.title}</h1>
              <ActionStatusBadge status={action.status} />
              {action.platform && (
                <span className="rounded-md bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  {action.platform}
                </span>
              )}
              <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {t(`agencyDept.actionType.${action.type}`)}
              </span>
              {action.is_pass_through && (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  {t('agencyDept.budget.passThroughShort')}
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Prestation : <span className="font-medium text-gray-700 dark:text-gray-200">{action.prestation?.name}</span> ({action.prestation?.reference})
              {action.prestation?.client && ` · Client : ${personName(action.prestation.client)}`}
            </p>

            {action.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line">{action.description}</p>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {canExecute && (
              <select
                value={action.status}
                onChange={(e) => handleActionStatusChange(e.target.value)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 shadow-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                {ACTION_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`agencyDept.actionStatus.${s}`)}
                  </option>
                ))}
              </select>
            )}

            {canManage && (
              <Button variant="outline" size="sm" onClick={openEditAction}>
                <Pencil className="h-4 w-4" /> Modifier l'action
              </Button>
            )}

            <Button size="sm" onClick={() => setManualModalOpen(true)}>
              <Plus className="h-4 w-4" /> Ajouter une exécution manuelle
            </Button>
          </div>
        </div>

        {/* Global Action KPIs */}
        <div className="mt-6 grid gap-4 border-t border-gray-100 pt-5 sm:grid-cols-2 lg:grid-cols-4 dark:border-gray-800">
          {/* Progression */}
          <div className="flex flex-col gap-1.5 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium">Progression globale</span>
              <span className="font-semibold text-gray-900 dark:text-white">{progress.percent}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${Math.min(100, progress.percent)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <span className="font-bold text-gray-900 dark:text-white">{progress.done}</span> sur {progress.expected} actions exécutées
            </p>
          </div>

          {/* Rythme & Fréquence */}
          <div className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <span className="text-xs text-gray-400 uppercase font-medium">Fréquence & Rythme</span>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {action.quantity} × {t(`agencyDept.frequency.${action.frequency}`)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {weeks.length} {action.frequency === 'per_month' ? 'mois' : 'semaines'} au total
            </p>
          </div>

          {/* Budget & Coût réel */}
          <div className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <span className="text-xs text-gray-400 uppercase font-medium">Budget alloué & Dépensé</span>
            <p className="text-base font-semibold text-gray-900 dark:text-white">{formatCurrency(totalBudget)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Dépensé réel : <span className="font-medium text-gray-700 dark:text-gray-200">{formatCurrency(totalCost)}</span>
            </p>
          </div>

          {/* Période & Assigné */}
          <div className="flex flex-col gap-1 rounded-xl bg-gray-50 p-4 dark:bg-gray-800/50">
            <span className="text-xs text-gray-400 uppercase font-medium">Période & Responsable</span>
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              {action.start_date ? action.start_date.slice(0, 10) : '—'} → {action.due_date ? action.due_date.slice(0, 10) : '—'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <User className="h-3 w-3" />
              {personName(action.assignee)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2">
          {/* Week Filter Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <select
              value={selectedWeek}
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'all' || val === 'current') setSelectedWeek(val);
                else setSelectedWeek(Number(val));
              }}
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              <option value="all">Toutes les semaines ({weeks.length})</option>
              {currentWeek && <option value="current">Semaine en cours (S{currentWeek.week_number})</option>}
              {weeks.map((w) => (
                <option key={w.week_number} value={w.week_number}>
                  Semaine {w.week_number} ({w.done}/{w.total} fait{w.is_current ? ' - En cours' : ''})
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              <option value="all">Tous les statuts</option>
              <option value="todo">À faire / En attente</option>
              <option value="done">Réalisés</option>
              <option value="overdue">En retard</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="w-full sm:w-64">
          <Input
            placeholder="Rechercher une exécution, note, lien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Main Content Area: Weekly Breakdown + Comments Sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Weekly Breakdown (2 cols) */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {weeks.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
              Aucune semaine trouvée pour cette action.
            </div>
          ) : (
            weeks
              .filter((w) => {
                if (selectedWeek === 'all') return true;
                if (selectedWeek === 'current') return w.is_current;
                return w.week_number === selectedWeek;
              })
              .map((w) => {
                const weekExecutions = executionsByWeek.get(w.week_number) ?? [];
                const isCollapsed = !!collapsedWeeks[w.week_number];

                return (
                  <div
                    key={w.week_number}
                    className={`overflow-hidden rounded-2xl border bg-white transition-shadow dark:bg-gray-900 ${
                      w.is_current
                        ? 'border-brand-500 shadow-sm ring-1 ring-brand-500/20 dark:border-brand-600'
                        : 'border-gray-100 dark:border-gray-800'
                    }`}
                  >
                    {/* Week Header */}
                    <div
                      className="flex cursor-pointer flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-5 py-3.5 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800/40 dark:hover:bg-gray-800/60"
                      onClick={() => toggleWeekCollapse(w.week_number)}
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          Semaine {w.week_number}
                        </span>
                        {w.week_start_date && w.week_end_date && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({w.week_start_date} → {w.week_end_date})
                          </span>
                        )}
                        {w.is_current && (
                          <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                            Semaine en cours
                          </span>
                        )}
                        {w.overdue > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                            {w.overdue} en retard
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {w.done} / {w.total} fait{w.total > 1 ? 's' : ''} ({w.percent}%)
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setManualForm((prev) => ({ ...prev, week_number: w.week_number }));
                            setManualModalOpen(true);
                          }}
                          title="Ajouter une exécution à cette semaine"
                          className="h-7 px-2 text-xs"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Week Execution Items */}
                    {!isCollapsed && (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {weekExecutions.length === 0 ? (
                          <p className="py-6 text-center text-xs text-gray-400 italic">
                            Aucune action correspondant aux filtres pour cette semaine.
                          </p>
                        ) : (
                          weekExecutions.map((item) => {
                            const isDone = item.status === 'done';

                            return (
                              <div
                                key={item.id}
                                className={`flex flex-col gap-3 p-4 transition-colors sm:flex-row sm:items-start sm:justify-between ${
                                  isDone ? 'bg-white dark:bg-gray-900' : 'bg-gray-50/30 dark:bg-gray-800/10'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  {/* Status Icon */}
                                  <div className="mt-0.5">
                                    {isDone ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                                    ) : item.is_overdue ? (
                                      <AlertCircle className="h-5 w-5 text-red-500" />
                                    ) : (
                                      <Clock className="h-5 w-5 text-amber-500" />
                                    )}
                                  </div>

                                  <div className="flex flex-col gap-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="font-semibold text-gray-900 dark:text-white">
                                        {item.title || `Action #${item.occurrence_number}`}
                                      </p>
                                      {item.is_manual && (
                                        <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                          Manuelle
                                        </span>
                                      )}
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                          isDone
                                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                            : item.is_overdue
                                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                        }`}
                                      >
                                        {isDone ? 'Réalisée' : item.is_overdue ? 'En retard' : 'À faire'}
                                      </span>
                                    </div>

                                    {/* Date & Proof Info */}
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                      {item.scheduled_date && (
                                        <span>Planifié : {item.scheduled_date.slice(0, 10)}</span>
                                      )}
                                      {isDone && item.done_at && (
                                        <span className="text-green-600 dark:text-green-400">
                                          Exécuté le : {item.done_at.slice(0, 10)}
                                        </span>
                                      )}
                                      {item.actual_cost && (
                                        <span className="flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                                          <Coins className="h-3 w-3" /> Coût : {formatCurrency(item.actual_cost)}
                                        </span>
                                      )}
                                      {item.user && (
                                        <span>Par : {personName(item.user)}</span>
                                      )}
                                    </div>

                                    {/* Proof Link */}
                                    {item.proof_url && (
                                      <div className="mt-1 flex items-center gap-1.5">
                                        <ExternalLink className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                                        <a
                                          href={item.proof_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400 break-all"
                                        >
                                          {item.proof_url}
                                        </a>
                                      </div>
                                    )}

                                    {/* Note */}
                                    {item.note && (
                                      <p className="mt-1 text-xs italic text-gray-600 dark:text-gray-400">
                                        « {item.note} »
                                      </p>
                                    )}
                                  </div>
                                </div>

                                {/* Item Actions */}
                                <div className="flex flex-wrap items-center gap-1 sm:self-center">
                                  {canExecute && !isDone && (
                                    <Button
                                      size="sm"
                                      onClick={() => openCompleteModal(item)}
                                      className="h-8 text-xs font-medium"
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" /> Marquer comme fait
                                    </Button>
                                  )}

                                  {canExecute && isDone && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openCompleteModal(item)}
                                        className="h-8 text-xs font-medium"
                                        title="Modifier la réalisation"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleReopenExecution(item)}
                                        className="h-8 text-xs font-medium text-gray-500 hover:text-amber-600"
                                        title="Rouvrir (remettre à faire)"
                                      >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                      </Button>
                                    </>
                                  )}

                                  {canManage && item.is_manual && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setDeleteTarget(item)}
                                      className="h-8 text-xs text-red-500 hover:text-red-700"
                                      title="Supprimer cette action manuelle"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
          )}
        </div>

        {/* Sidebar: Comments & Communication */}
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
              <MessageSquare className="h-4 w-4 text-brand-600 dark:text-brand-400" />
              Échanges & Commentaires
            </h2>

            {/* Comment Form */}
            {canExecute && (
              <form onSubmit={handleAddComment} className="mb-4 flex flex-col gap-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  placeholder="Écrire un commentaire ou une remarque sur l'action..."
                  rows={3}
                  className="w-full rounded-xl border border-gray-200 bg-transparent p-2.5 text-xs text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:text-white"
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" isLoading={commentSubmitting} disabled={!commentBody.trim()}>
                    Envoyer
                  </Button>
                </div>
              </form>
            )}

            {/* Comments List */}
            <div className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1">
              {comments.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-400">Aucun commentaire pour le moment.</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800/60">
                    <p className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-line">{c.body}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
                      <span>{personName(c.author)}</span>
                      <span>{c.created_at.slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Complete / Edit Execution */}
      <Modal
        isOpen={completeModalTarget !== null}
        onClose={() => setCompleteModalTarget(null)}
        title={
          completeModalTarget?.status === 'done'
            ? `Modifier la réalisation — ${completeModalTarget.title}`
            : `Enregistrer la réalisation — ${completeModalTarget?.title ?? ''}`
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleCompleteSubmit} className="flex flex-col gap-4">
          <Input
            label="Date effective d'exécution"
            type="date"
            required
            value={completeForm.done_at}
            onChange={(e) => setCompleteForm({ ...completeForm, done_at: e.target.value })}
          />

          <Input
            label="Preuve / Lien de réalisation (URL)"
            placeholder="https://facebook.com/... ou https://tiktok.com/..."
            value={completeForm.proof_url}
            onChange={(e) => setCompleteForm({ ...completeForm, proof_url: e.target.value })}
          />

          <Input
            label="Coût réel engagé (FCFA, optionnel)"
            type="number"
            min={0}
            placeholder="0"
            value={completeForm.actual_cost}
            onChange={(e) => setCompleteForm({ ...completeForm, actual_cost: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Note ou compte-rendu
            </label>
            <textarea
              rows={3}
              value={completeForm.note}
              onChange={(e) => setCompleteForm({ ...completeForm, note: e.target.value })}
              placeholder="Ex: Publication programmée avec succès, 150 interactions initiales..."
              className="w-full rounded-xl border border-gray-200 bg-transparent p-2.5 text-xs text-gray-900 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCompleteModalTarget(null)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={completeSubmitting}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Manual Execution */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Ajouter une exécution manuelle à l'action globale"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleManualSubmit} className="flex flex-col gap-4">
          <p className="text-xs text-gray-500">
            Cette action sera ajoutée à l'action globale « {action.title} » et prise en compte dans le suivi et le décompte global.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Semaine de rattachement"
              value={manualForm.week_number}
              onChange={(e) => setManualForm({ ...manualForm, week_number: Number(e.target.value) })}
            >
              {weeks.map((w) => (
                <option key={w.week_number} value={w.week_number}>
                  Semaine {w.week_number} ({w.week_start_date ?? ''} → {w.week_end_date ?? ''})
                </option>
              ))}
            </Select>

            <Input
              label="Date prévue / effectuée"
              type="date"
              required
              value={manualForm.scheduled_date}
              onChange={(e) => setManualForm({ ...manualForm, scheduled_date: e.target.value })}
            />
          </div>

          <Input
            label="Titre de l'exécution"
            placeholder="Ex: Post exceptionnel événement, vidéo supplémentaire..."
            value={manualForm.title}
            onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
          />

          <Select
            label="Statut initial"
            value={manualForm.status}
            onChange={(e) => setManualForm({ ...manualForm, status: e.target.value as any })}
          >
            <option value="todo">À faire (Planifié)</option>
            <option value="done">Déjà réalisé</option>
          </Select>

          {manualForm.status === 'done' && (
            <>
              <Input
                label="Lien de preuve (URL)"
                placeholder="https://..."
                value={manualForm.proof_url}
                onChange={(e) => setManualForm({ ...manualForm, proof_url: e.target.value })}
              />
              <Input
                label="Coût réel (FCFA, optionnel)"
                type="number"
                min={0}
                value={manualForm.actual_cost}
                onChange={(e) => setManualForm({ ...manualForm, actual_cost: e.target.value })}
              />
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Note explicative
            </label>
            <textarea
              rows={2}
              value={manualForm.note}
              onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
              placeholder="Ex: Demande expresse du client par WhatsApp..."
              className="w-full rounded-xl border border-gray-200 bg-transparent p-2.5 text-xs text-gray-900 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:text-white"
            />
          </div>

          <EmployeePicker
            label="Responsable"
            agencyId={agencyId}
            value={manualForm.assigned_to}
            onChange={(id) => setManualForm({ ...manualForm, assigned_to: id || '' })}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setManualModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" isLoading={manualSubmitting}>
              Ajouter l'exécution
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Action Globale */}
      <Modal
        isOpen={editActionOpen}
        onClose={() => setEditActionOpen(false)}
        title="Modifier l'action globale"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveAction} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('agencyDept.actions.title')}
              required
              value={actionForm.title ?? ''}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
            />
            <Select
              label={t('agencyDept.actions.type')}
              value={actionForm.type}
              onChange={(e) => setActionForm({ ...actionForm, type: e.target.value as any })}
            >
              {ACTION_TYPES.map((a) => (
                <option key={a} value={a}>
                  {t(`agencyDept.actionType.${a}`)}
                </option>
              ))}
            </Select>

            <Input
              label={t('agencyDept.actions.platform')}
              value={actionForm.platform ?? ''}
              onChange={(e) => setActionForm({ ...actionForm, platform: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-2">
              <Input
                label={t('agencyDept.quantity')}
                type="number"
                min={1}
                value={actionForm.quantity ?? 1}
                onChange={(e) => setActionForm({ ...actionForm, quantity: Number(e.target.value) })}
              />
              <Select
                label={t('agencyDept.actions.frequency')}
                value={actionForm.frequency}
                onChange={(e) => setActionForm({ ...actionForm, frequency: e.target.value as any })}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {t(`agencyDept.frequency.${f}`)}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label={t('agencyDept.budget.title')}
              type="number"
              min={0}
              value={actionForm.budget ?? 0}
              onChange={(e) => setActionForm({ ...actionForm, budget: Number(e.target.value) })}
            />

            <EmployeePicker
              label={t('agencyDept.actions.assignee')}
              agencyId={agencyId}
              value={actionForm.assigned_to ?? ''}
              onChange={(id) => setActionForm({ ...actionForm, assigned_to: id || null })}
            />

            <Input
              label={t('agencyDept.startDate')}
              type="date"
              value={actionForm.start_date ?? ''}
              onChange={(e) => setActionForm({ ...actionForm, start_date: e.target.value || null })}
            />

            <Input
              label={t('agencyDept.actions.dueDate')}
              type="date"
              value={actionForm.due_date ?? ''}
              onChange={(e) => setActionForm({ ...actionForm, due_date: e.target.value || null })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditActionOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer</Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Execution Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Supprimer cette exécution manuelle"
        message={`Êtes-vous sûr de vouloir supprimer l'exécution « ${deleteTarget?.title ?? ''} » ?`}
        variant="danger"
        onConfirm={handleDeleteExecution}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

