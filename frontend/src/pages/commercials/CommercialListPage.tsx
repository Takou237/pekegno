import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Search, Pencil, Eye, Trash2, UserPlus, Download, Trophy, Star, BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { commercialsApi } from '@/api/commercials.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { downloadExport } from '@/api/exports.api';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { currentLocale } from '@/i18n';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Alert } from '@/components/ui/Alert';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CommercialForm, commercialFormFrom, type CommercialFormValues } from '@/components/commercials/CommercialForm';
import { canExportData } from '@/utils/exportPermissions';
import type { Commercial, RankingEntry } from '@/types/commercial';
import type { PaginationMeta } from '@/types/agency';

function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${new Intl.NumberFormat(currentLocale()).format(n)} FCFA`;
}

export default function CommercialListPage({ fixedAgencyId }: { fixedAgencyId?: string }) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const commercialPath = (cId: string) =>
    fixedAgencyId ? `/agencies/${fixedAgencyId}/commercials/${cId}` : `/commercials/${cId}`;

  const [commercials, setCommercials] = useState<Commercial[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editCommercial, setEditCommercial] = useState<Commercial | null>(null);
  const [form, setForm] = useState<CommercialFormValues>(commercialFormFrom(null));
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<Commercial | null>(null);
  const [adjustPoints, setAdjustPoints] = useState('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const [rankingOpen, setRankingOpen] = useState(false);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Commercial | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const canManage = ['super-admin', 'direction-generale', 'responsable-agence'].includes(
    currentUser?.role?.name ?? ''
  );
  const canAdjustPoints = ['super-admin', 'direction-generale'].includes(
    currentUser?.role?.name ?? ''
  );

  const fetchParams = useMemo(
    () => ({
      search: search || undefined,
      is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
      agency_id: fixedAgencyId || undefined,
      page,
    }),
    [search, statusFilter, page, fixedAgencyId]
  );

  async function fetchCommercials() {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await commercialsApi.list({ ...fetchParams, per_page: 15 });
      setCommercials(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('commercials.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchCommercials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchParams]);

  useEffect(() => {
    const timeout = setTimeout(() => setPage(1), 350);
    return () => clearTimeout(timeout);
  }, [search, statusFilter]);

  function openCreate() {
    setEditCommercial(null);
    setForm(commercialFormFrom(null, fixedAgencyId));
    setFormErrors({});
    setFormOpen(true);
  }

  function openEdit(commercial: Commercial) {
    setEditCommercial(commercial);
    setForm(commercialFormFrom(commercial, fixedAgencyId));
    setFormErrors({});
    setFormOpen(true);
  }

  function commissionLabel(commercial: Commercial): string {
    if (commercial.commission_type === 'percent') {
      return `${commercial.commission_value ?? 0}%`;
    }
    if (commercial.commission_type === 'fixed') {
      return formatCurrency(commercial.commission_value);
    }
    return t('commercials.commissionNone');
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormSubmitting(true);
    setFormErrors({});
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email || null,
        phone: form.phone || null,
        user_id: form.user_id || null,
        agency_id: form.agency_id || null,
        commission_type: form.commission_type,
        commission_value:
          form.commission_type === 'none' ? null : form.commission_value || 0,
        is_active: form.is_active,
      };
      if (editCommercial) {
        await commercialsApi.update(editCommercial.id, payload);
        showToast(t('commercials.updated'), 'success');
      } else {
        await commercialsApi.create(payload);
        showToast(t('commercials.created'), 'success');
      }
      setFormOpen(false);
      fetchCommercials();
    } catch (error) {
      setFormErrors(extractFieldErrors(error));
      const msg = extractErrorMessage(error, t('commercials.saveFailed'));
      if (msg) showToast(msg, 'error');
    } finally {
      setFormSubmitting(false);
    }
  }

  function openAdjust(commercial: Commercial) {
    setAdjustTarget(commercial);
    setAdjustPoints('');
    setAdjustSubmitting(false);
  }

  async function handleAdjust(event: FormEvent) {
    event.preventDefault();
    if (!adjustTarget) return;
    const value = Number(adjustPoints);
    if (!Number.isFinite(value) || value === 0) return;
    setAdjustSubmitting(true);
    try {
      await commercialsApi.adjustPoints(adjustTarget.id, value);
      showToast(t('commercials.adjusted'), 'success');
      setAdjustTarget(null);
      fetchCommercials();
    } catch (error) {
      showToast(extractErrorMessage(error, t('commercials.adjustFailed')), 'error');
    } finally {
      setAdjustSubmitting(false);
    }
  }

  async function openRanking() {
    setRankingOpen(true);
    setRankingLoading(true);
    try {
      setRanking(await commercialsApi.ranking({ limit: 50 }));
    } catch (error) {
      showToast(extractErrorMessage(error, t('commercials.loadFailed')), 'error');
    } finally {
      setRankingLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      await commercialsApi.remove(deleteTarget.id);
      showToast(t('commercials.deleted'), 'success');
      setDeleteTarget(null);
      fetchCommercials();
    } catch (error) {
      showToast(extractErrorMessage(error, t('commercials.deleteFailed')), 'error');
    } finally {
      setDeleteSubmitting(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      await downloadExport('commercials');
    } catch (error) {
      showToast(extractErrorMessage(error, t('common.exportFailed')), 'error');
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('commercials.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canExportData(currentUser) && (
            <Button variant="outline" onClick={handleExport} isLoading={isExporting}>
              <Download className="h-4 w-4" />
              {t('commercials.export')}
            </Button>
          )}
          <Button variant="outline" onClick={openRanking}>
            <Trophy className="h-4 w-4" />
            {t('commercials.rankingPoints')}
          </Button>
          {canManage && (
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              {t('commercials.createCommercial')}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('commercials.searchPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="w-48">
          <Select
            label={t('common.status')}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">{t('common.selectAll')}</option>
            <option value="active">{t('common.active')}</option>
            <option value="inactive">{t('common.inactive')}</option>
          </Select>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : commercials.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('commercials.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercials.colAgency')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercials.colPoints')}</th>
                  <th className="px-5 py-3 font-medium">{t('commercials.colCommission')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3 text-right font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {commercials.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => navigate(commercialPath(c.id))}
                        className="font-medium text-gray-800 hover:text-brand-600 dark:text-gray-100"
                      >
                        {[c.first_name, c.last_name].filter(Boolean).join(' ')}
                      </button>
                      {c.user && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] text-brand-600 dark:text-brand-400" title={`${c.user.first_name ?? ''} ${c.user.last_name ?? ''} (${c.user.email})`.trim()}>
                          <BadgeCheck className="h-3 w-3" />
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {c.agency?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-100">
                        <Star className="h-3.5 w-3.5 text-brand-500" />
                        {c.points_balance}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {commissionLabel(c)}
                    </td>
                    <td className="px-5 py-3">
                      {c.is_active ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="error">{t('common.inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(commercialPath(c.id))}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                          title={t('commercials.viewDetail')}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canAdjustPoints && (
                          <button
                            type="button"
                            onClick={() => openAdjust(c)}
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                            title={t('commercials.adjustPoints')}
                          >
                            <Star className="h-4 w-4" />
                          </button>
                        )}
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEdit(c)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                              title={t('common.edit')}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(c)}
                              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
                              title={t('common.delete')}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && (
          <div className="border-t border-gray-100 p-4 dark:border-gray-800">
            <Pagination
              currentPage={meta.current_page}
              lastPage={meta.last_page}
              total={meta.total}
              perPage={meta.per_page}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editCommercial ? t('commercials.editTitle') : t('commercials.createTitle')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
          {Object.keys(formErrors).length > 0 && (
            <Alert variant="error">{Object.values(formErrors).join(' ')}</Alert>
          )}
          <CommercialForm
            value={form}
            onChange={setForm}
            errors={formErrors}
            fixedAgencyId={fixedAgencyId}
            linkedUserLabel={
              editCommercial?.user
                ? [editCommercial.user.first_name, editCommercial.user.last_name]
                    .filter(Boolean)
                    .join(' ') || editCommercial.user.email
                : ''
            }
          />
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={formSubmitting} className="flex-1">
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={
          adjustTarget
            ? t('commercials.adjustTitle', {
                name: [adjustTarget.first_name, adjustTarget.last_name].filter(Boolean).join(' '),
              })
            : ''
        }
        maxWidth="max-w-md"
      >
        {adjustTarget && (
          <form onSubmit={handleAdjust} className="flex flex-col gap-4">
            <Alert variant="info">{t('commercials.adjustHint')}</Alert>
            <Input
              label={t('commercials.pointsValue')}
              type="number"
              required
              value={adjustPoints}
              onChange={(e) => setAdjustPoints(e.target.value)}
              placeholder="+10 / -5"
            />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setAdjustTarget(null)} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button type="submit" isLoading={adjustSubmitting} className="flex-1">
                {t('common.confirm')}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={rankingOpen}
        onClose={() => setRankingOpen(false)}
        title={t('commercials.rankingPoints')}
        maxWidth="max-w-xl"
      >
        {rankingLoading ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : ranking.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
            {t('commercials.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-2 font-medium">{t('commercials.rank')}</th>
                  <th className="px-4 py-2 font-medium">{t('commercials.colName')}</th>
                  <th className="px-4 py-2 font-medium">{t('commercials.colPoints')}</th>
                  <th className="px-4 py-2 font-medium">{t('commercials.statsSales')}</th>
                  <th className="px-4 py-2 text-right font-medium">{t('commercials.statsTurnover')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {ranking.map((r, index) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          index === 0
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-gray-800 dark:text-gray-100">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ')}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.points_balance}</td>
                    <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{r.sales_count}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-300">
                      {formatCurrency(r.turnover)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={t('commercials.deleteTitle')}
        message={
          deleteTarget
            ? t('commercials.deleteMessage', {
                name: [deleteTarget.first_name, deleteTarget.last_name].filter(Boolean).join(' '),
              })
            : ''
        }
        confirmLabel={t('common.deletePermanently')}
        variant="danger"
        isLoading={deleteSubmitting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
