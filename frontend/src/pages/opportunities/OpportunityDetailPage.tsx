import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Clock,
  Check,
  Trash2,
  Plus,
} from 'lucide-react';
import { opportunitiesApi } from '@/api/opportunities.api';
import { activitiesApi } from '@/api/activities.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { formatCurrency } from '@/utils/number';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SkeletonDetail } from '@/components/ui/Skeleton';
import type { Opportunity, OpportunityStage } from '@/types/opportunity';
import { STAGE_LABELS, STAGE_COLORS, OPEN_STAGES } from '@/types/opportunity';
import type { Activity, ActivityType } from '@/types/activity';
import { ACTIVITY_TYPE_LABELS } from '@/types/activity';

const ALL_STAGES: OpportunityStage[] = [
  'new',
  'contacted',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

const ACTIVITY_ICONS: Record<ActivityType, typeof Phone> = {
  call: Phone,
  meeting: Calendar,
  email: Mail,
  whatsapp: MessageCircle,
  note: FileText,
  followup: Clock,
};

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [activityForm, setActivityForm] = useState({
    type: 'call' as ActivityType,
    title: '',
    notes: '',
    due_at: '',
  });
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completeOutcome, setCompleteOutcome] = useState('');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadOpportunity = useCallback(() => {
    if (!id) return;
    setLoading(true);
    opportunitiesApi
      .get(id)
      .then((data) => setOpportunity(data.data))
      .catch((err) =>
        setError(extractErrorMessage(err, t('opportunities.loadError')))
      )
      .finally(() => setLoading(false));
  }, [id, t]);

  const loadActivities = useCallback(() => {
    if (!id) return;
    setActivitiesLoading(true);
    activitiesApi
      .list({
        subject_type: 'App\\Models\\Opportunity',
        subject_id: id,
        per_page: 100,
      })
      .then((res) => setActivities(res.data.data))
      .catch(() => {})
      .finally(() => setActivitiesLoading(false));
  }, [id]);

  useEffect(() => {
    loadOpportunity();
  }, [loadOpportunity]);
  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  async function handleStageChange(newStage: OpportunityStage) {
    if (!opportunity) return;
    try {
      const updated = await opportunitiesApi.changeStage(
        opportunity.id,
        newStage
      );
      setOpportunity(updated.data);
      showToast(t('opportunities.stageMoved'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('opportunities.error')), 'error');
    }
  }

  async function handleCreateActivity(e: FormEvent) {
    e.preventDefault();
    if (!id || !activityForm.title) return;
    setActivitySubmitting(true);
    try {
      await activitiesApi.create({
        subject_type: 'App\\Models\\Opportunity',
        subject_id: id,
        type: activityForm.type,
        title: activityForm.title,
        notes: activityForm.notes || undefined,
        due_at: activityForm.due_at || undefined,
      });
      setActivityForm({ type: 'call', title: '', notes: '', due_at: '' });
      showToast(t('activities.created'), 'success');
      loadActivities();
    } catch (err) {
      showToast(extractErrorMessage(err, t('activities.error')), 'error');
    } finally {
      setActivitySubmitting(false);
    }
  }

  async function handleCompleteActivity(activityId: string) {
    try {
      await activitiesApi.complete(activityId, completeOutcome || undefined);
      setCompletingId(null);
      setCompleteOutcome('');
      showToast(t('activities.completed'), 'success');
      loadActivities();
    } catch (err) {
      showToast(extractErrorMessage(err, t('activities.error')), 'error');
    }
  }

  async function handleDelete() {
    if (!opportunity) return;
    setDeleting(true);
    try {
      await opportunitiesApi.remove(opportunity.id);
      showToast(t('opportunities.deleted'), 'success');
      window.location.href = '/opportunities';
    } catch (err) {
      showToast(extractErrorMessage(err, t('opportunities.error')), 'error');
      setDeleting(false);
    }
  }

  const currentStageIndex = opportunity
    ? ALL_STAGES.indexOf(opportunity.stage)
    : -1;
  const nextStages =
    opportunity && OPEN_STAGES.includes(opportunity.stage)
      ? ALL_STAGES.slice(currentStageIndex + 1)
      : [];

  const today = new Date().toISOString().slice(0, 16);

  if (loading) return <SkeletonDetail />;

  if (error || !opportunity) {
    return (
      <div className="flex flex-col gap-4">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('opportunities.backToList')}
        </Link>
        <p className="text-sm text-error-500">
          {error ?? t('opportunities.loadError')}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back link & header */}
      <div>
        <Link
          to="/opportunities"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('opportunities.backToList')}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {opportunity.title}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STAGE_COLORS[opportunity.stage]}`}
              >
                {STAGE_LABELS[opportunity.stage]}
              </span>
            </div>
            {opportunity.expected_amount != null && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {t('opportunities.expectedAmount')}:{' '}
                {formatCurrency(opportunity.expected_amount)}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setDeleteOpen(true)}
            className="text-error-500 hover:border-error-300 hover:text-error-600"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            {t('common.delete')}
          </Button>
        </div>
      </div>

      {/* Info section */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.titleField')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.title}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.stageLabel')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {STAGE_LABELS[opportunity.stage]}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.expectedAmount')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.expected_amount != null
                ? formatCurrency(opportunity.expected_amount)
                : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.expectedCloseDate')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.expected_close_date
                ? new Date(
                    opportunity.expected_close_date
                  ).toLocaleDateString(currentLocale())
                : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.commercial')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.commercial
                ? `${opportunity.commercial.first_name} ${opportunity.commercial.last_name}`
                : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.company')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.company?.name ?? '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.prospect')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.prospect
                ? [opportunity.prospect.first_name, opportunity.prospect.last_name]
                    .filter(Boolean)
                    .join(' ') || opportunity.prospect.email
                : '\u2014'}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t('opportunities.agency')}
            </dt>
            <dd className="mt-0.5 text-sm text-gray-800 dark:text-gray-100">
              {opportunity.agency?.name ?? '\u2014'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Stage change buttons */}
      {OPEN_STAGES.includes(opportunity.stage) && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('opportunities.changeStage')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {nextStages.map((stage) => (
              <Button
                key={stage}
                variant="outline"
                size="sm"
                onClick={() => handleStageChange(stage)}
              >
                {STAGE_LABELS[stage]}
              </Button>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => handleStageChange('won')}
            >
              {STAGE_LABELS.won}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => handleStageChange('lost')}
            >
              {STAGE_LABELS.lost}
            </Button>
          </div>
        </div>
      )}

      {/* Quick create activity */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
          {t('activities.quickCreate')}
        </h2>
        <form onSubmit={handleCreateActivity} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-500">
                {t('activities.type')}
              </label>
              <select
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                value={activityForm.type}
                onChange={(e) =>
                  setActivityForm({
                    ...activityForm,
                    type: e.target.value as ActivityType,
                  })
                }
              >
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label={t('activities.titleField')}
              value={activityForm.title}
              onChange={(e) =>
                setActivityForm({ ...activityForm, title: e.target.value })
              }
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('activities.notes')}
              value={activityForm.notes}
              onChange={(e) =>
                setActivityForm({ ...activityForm, notes: e.target.value })
              }
            />
            <Input
              label={t('activities.dueAt')}
              type="datetime-local"
              min={today}
              value={activityForm.due_at}
              onChange={(e) =>
                setActivityForm({ ...activityForm, due_at: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={activitySubmitting || !activityForm.title}
            >
              {activitySubmitting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              {t('activities.create')}
            </Button>
          </div>
        </form>
      </div>

      {/* Activities timeline */}
      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {t('activities.timeline')}
          </h2>
        </div>
        {activitiesLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : activities.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('activities.noActivities')}
          </p>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {activities.map((activity) => {
              const Icon = ACTIVITY_ICONS[activity.type] || Clock;
              const isCompleted = !!activity.completed_at;
              return (
                <div key={activity.id} className="flex gap-4 px-5 py-4">
                  <div
                    className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isCompleted
                            ? 'text-gray-500 line-through'
                            : 'text-gray-800 dark:text-gray-100'
                        }`}
                      >
                        {activity.title}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        {ACTIVITY_TYPE_LABELS[activity.type]}
                      </span>
                      {isCompleted && (
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                      )}
                    </div>
                    {activity.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {activity.notes}
                      </p>
                    )}
                    {activity.due_at && (
                      <p className="flex items-center gap-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        {new Date(activity.due_at).toLocaleString(
                          currentLocale()
                        )}
                      </p>
                    )}
                    {activity.outcome && (
                      <p className="text-xs text-gray-500 italic">
                        {t('activities.outcome')}: {activity.outcome}
                      </p>
                    )}
                    {!isCompleted && (
                      <div className="mt-1">
                        {completingId === activity.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              placeholder={t('activities.outcomePlaceholder')}
                              value={completeOutcome}
                              onChange={(e) =>
                                setCompleteOutcome(e.target.value)
                              }
                              className="max-w-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() =>
                                handleCompleteActivity(activity.id)
                              }
                            >
                              <Check className="h-3.5 w-3.5 mr-1" />
                              {t('activities.confirm')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCompletingId(null);
                                setCompleteOutcome('');
                              }}
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCompletingId(activity.id)}
                          >
                            <Check className="h-3.5 w-3.5 mr-1" />
                            {t('activities.markComplete')}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('opportunities.deleteConfirmTitle')}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {t('opportunities.deleteConfirmMessage')}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteOpen(false)}
                disabled={deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="outline"
                className="border-error-300 text-error-600 hover:bg-error-50"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Spinner className="h-4 w-4" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1.5" />
                )}
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
