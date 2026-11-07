import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, ClipboardList, Clock, ExternalLink, Pencil, Play } from 'lucide-react';
import { academyApi } from '@/api/academy.api';
import { uploadsApi } from '@/api/uploads.api';
import { extractErrorMessage } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { todayLocal } from '@/utils/date';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { currentLocale } from '@/i18n';
import type { ExecutionStatus, TrainerRealization, TrainerRealizationPage } from '@/types/agencyDepartment';
import { StatCard } from './trainerShared';

const STATUS_FILTERS: ExecutionStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];

const STATUS_VARIANT: Record<ExecutionStatus, 'neutral' | 'warning' | 'success' | 'error'> = {
  todo: 'neutral',
  in_progress: 'warning',
  done: 'success',
  cancelled: 'error',
};

interface CompleteForm {
  done_at: string;
  proof_url: string;
  proof_file: string;
  actual_cost: string;
  note: string;
}

function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(url);
}

function formatDay(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString(currentLocale(), {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * « Mes réalisations » : réalisations de production du pôle studio assignées
 * au formateur (GET /trainers/me/realizations). Il peut les démarrer puis les
 * enregistrer comme réalisées avec date, preuve, coût et note ; la
 * planification et l'affectation restent gérées par le pôle studio.
 */
export default function TrainerRealizationsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const [result, setResult] = useState<TrainerRealizationPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [status, setStatus] = useState<ExecutionStatus | ''>('');
  const [overdue, setOverdue] = useState(false);
  const [page, setPage] = useState(1);
  const [startingId, setStartingId] = useState<string | null>(null);

  const [target, setTarget] = useState<TrainerRealization | null>(null);
  const [form, setForm] = useState<CompleteForm>({ done_at: '', proof_url: '', proof_file: '', actual_cost: '', note: '' });
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setResult(
        await academyApi.myRealizations({
          status: status || undefined,
          overdue: overdue || undefined,
          page,
          per_page: 20,
        }),
      );
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [status, overdue, page, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStart(item: TrainerRealization) {
    setStartingId(item.id);
    try {
      await academyApi.updateMyRealization(item.id, { status: 'in_progress' });
      showToast(t('academy.realizationStarted'), 'success');
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setStartingId(null);
    }
  }

  function openComplete(item: TrainerRealization) {
    setTarget(item);
    setForm({
      done_at: item.done_at ? item.done_at.slice(0, 10) : todayLocal(),
      proof_url: item.proof_url ?? '',
      proof_file: item.proof_file ?? '',
      actual_cost: item.actual_cost != null ? String(item.actual_cost) : '',
      note: item.note ?? '',
    });
  }

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadsApi.upload(file);
      setForm((f) => ({ ...f, proof_file: uploaded.url }));
      showToast(t('academy.realizationProofUploaded'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    setSubmitting(true);
    try {
      await academyApi.updateMyRealization(target.id, {
        status: 'done',
        done_at: form.done_at,
        proof_url: form.proof_url.trim() || null,
        proof_file: form.proof_file.trim() || null,
        actual_cost: form.actual_cost ? Number(form.actual_cost) : null,
        note: form.note.trim() || null,
      });
      showToast(t('academy.realizationSaved'), 'success');
      setTarget(null);
      load();
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.error')), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const summary = result?.summary;
  const items = result?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <ClipboardList className="h-5 w-5" />
          {t('academy.selfRealizations')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.selfRealizationsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t('academy.realizationsTotal')} value={summary?.total ?? 0} icon={ClipboardList} tone="bg-brand-50 text-brand-600 dark:bg-brand-500/10" />
        <StatCard label={t('academy.realizationsTodo')} value={(summary?.todo ?? 0) + (summary?.in_progress ?? 0)} icon={Clock} tone="bg-warning-50 text-warning-600 dark:bg-warning-500/10" />
        <StatCard label={t('academy.realizationsDone')} value={summary?.done ?? 0} icon={CheckCircle2} tone="bg-success-50 text-success-600 dark:bg-success-500/10" />
        <StatCard label={t('academy.realizationsOverdue')} value={summary?.overdue ?? 0} icon={AlertCircle} tone="bg-error-50 text-error-600 dark:bg-error-500/10" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <Select
            aria-label={t('common.status')}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as ExecutionStatus | '');
              setPage(1);
            }}
          >
            <option value="">{t('academy.realizationsAllStatuses')}</option>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {t(`agencyDept.actionStatus.${s}`)}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={overdue}
            onChange={(e) => {
              setOverdue(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
          />
          {t('academy.realizationOnlyOverdue')}
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('academy.noRealizations')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">{t('academy.realization')}</th>
                  <th className="px-4 py-3">{t('academy.realizationProject')}</th>
                  <th className="px-4 py-3">{t('academy.realizationDue')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('academy.realizationProof')}</th>
                  <th className="px-4 py-3 text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((item) => {
                  const prestation = item.action?.prestation;
                  const due = item.scheduled_date ?? item.week_end_date;
                  const proof = item.proof_file || item.proof_url;
                  const closed = item.status === 'cancelled';
                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 dark:text-white">{item.title || item.action?.title || '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {item.action?.title}
                          {item.week_number ? ` · ${t('academy.week')} ${item.week_number}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-gray-900 dark:text-white">{prestation?.name ?? '—'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {[prestation?.reference, prestation?.agency?.name].filter(Boolean).join(' · ')}
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={item.is_overdue ? 'font-medium text-error-600' : 'text-gray-700 dark:text-gray-300'}>
                          {formatDay(due)}
                        </span>
                        {item.status === 'done' && item.done_at && (
                          <p className="text-xs text-success-600">{formatDay(item.done_at)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={STATUS_VARIANT[item.status]}>{t(`agencyDept.actionStatus.${item.status}`)}</Badge>
                          {item.is_overdue && <Badge variant="error">{t('academy.realizationsOverdue')}</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {proof ? (
                          <a
                            href={proof}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t('academy.realizationViewProof')}
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!closed && (
                          <div className="flex justify-end gap-2">
                            {item.status === 'todo' && (
                              <Button
                                size="sm"
                                variant="outline"
                                isLoading={startingId === item.id}
                                onClick={() => handleStart(item)}
                              >
                                <Play className="h-3.5 w-3.5" />
                                {t('academy.realizationStart')}
                              </Button>
                            )}
                            <Button size="sm" variant={item.status === 'done' ? 'outline' : 'primary'} onClick={() => openComplete(item)}>
                              {item.status === 'done' ? <Pencil className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              {item.status === 'done' ? t('academy.realizationEdit') : t('academy.realizationSubmit')}
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.last_page > 1 && (
        <Pagination
          currentPage={result.current_page}
          lastPage={result.last_page}
          total={result.total}
          perPage={result.per_page}
          onPageChange={setPage}
        />
      )}

      <Modal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
        title={t('academy.realizationModalTitle', { title: target?.title || target?.action?.title || '' })}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label={t('academy.realizationDoneAt')}
            type="date"
            required
            max={todayLocal()}
            value={form.done_at}
            onChange={(e) => setForm({ ...form, done_at: e.target.value })}
          />

          <Input
            label={t('academy.realizationProofUrl')}
            placeholder="https://"
            value={form.proof_url}
            onChange={(e) => setForm({ ...form, proof_url: e.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{t('academy.realizationProofFile')}</span>
            {form.proof_file && (
              <div className="flex items-center gap-2">
                <a
                  href={form.proof_file}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                >
                  {t('academy.realizationViewProof')}
                </a>
                <button type="button" onClick={() => setForm({ ...form, proof_file: '' })} className="text-xs text-red-500 hover:underline">
                  {t('common.remove')}
                </button>
              </div>
            )}
            {form.proof_file && isImageUrl(form.proof_file) && (
              <img
                src={form.proof_file}
                alt={t('academy.realizationProof')}
                className="h-20 w-auto max-w-40 rounded-lg border border-gray-200 object-cover dark:border-gray-700"
              />
            )}
            <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-300 px-4 py-3 text-xs text-gray-500 hover:border-brand-500 hover:text-brand-600 dark:border-gray-700 dark:text-gray-400">
              {uploading ? t('common.loading') : t('academy.realizationUpload')}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,.pdf,.doc,.docx,.mp4,.mov,.mp3"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  handleUpload(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
            </label>
          </div>

          <Input
            label={t('academy.realizationCost')}
            type="number"
            min={0}
            placeholder="0"
            value={form.actual_cost}
            onChange={(e) => setForm({ ...form, actual_cost: e.target.value })}
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">{t('academy.realizationNote')}</label>
            <textarea
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-transparent p-2.5 text-xs text-gray-900 focus:border-brand-500 focus:outline-hidden dark:border-gray-700 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={submitting} disabled={uploading}>
              {t('academy.realizationSubmit')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
