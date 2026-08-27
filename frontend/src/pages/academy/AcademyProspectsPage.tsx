import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, ArrowRightLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { prospectsApi } from '@/api/prospects.api';
import type { Prospect } from '@/types/prospect';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';

interface DepartmentLayoutContext {
  department?: { id: string; agency_id?: string } | null;
  departmentId?: string;
  agencyId?: string;
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  address: string;
  notes: string;
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  city: '',
  country: '',
  address: '',
  notes: '',
};

export default function AcademyProspectsPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { agencyId } = useOutletContext<DepartmentLayoutContext>();

  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [convertTarget, setConvertTarget] = useState<Prospect | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  const fetchProspects = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await prospectsApi.list({
        agency_id: agencyId || undefined,
        search: search || undefined,
        page,
        per_page: 15,
      });
      setProspects(response.data);
      setMeta(response.meta);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('prospects.saveFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [agencyId, search, page, t]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(p: Prospect) {
    setEditing(p);
    setForm({
      first_name: p.first_name,
      last_name: p.last_name,
      email: p.email ?? '',
      phone: p.phone ?? '',
      city: p.city ?? '',
      country: p.country ?? '',
      address: p.address ?? '',
      notes: p.notes ?? '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (editing) {
        await prospectsApi.update(editing.id, form);
        showToast(t('prospects.updated'), 'success');
      } else {
        await prospectsApi.create({ ...form, agency_id: agencyId || undefined });
        showToast(t('prospects.created'), 'success');
      }
      setFormOpen(false);
      fetchProspects();
    } catch (error) {
      setFormError(extractErrorMessage(error, t('prospects.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(p: Prospect) {
    if (!window.confirm(t('prospects.deleteMessage', { name: `${p.first_name} ${p.last_name}` }))) return;
    try {
      await prospectsApi.remove(p.id);
      showToast(t('prospects.deleted'), 'success');
      fetchProspects();
    } catch {
      showToast(t('prospects.deleteFailed'), 'error');
    }
  }

  async function handleConvert() {
    if (!convertTarget) return;
    setIsConverting(true);
    try {
      await prospectsApi.convert(convertTarget.id);
      showToast(t('prospects.converted'), 'success');
      setConvertTarget(null);
      fetchProspects();
    } catch {
      showToast(t('prospects.convertFailed'), 'error');
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('prospects.title')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('prospects.subtitle')}</p>
        </div>
        <Button onClick={openCreate} className="inline-flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('prospects.addProspect')}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder={t('common.search')}
          className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm dark:border-gray-700 dark:bg-gray-900"
        />
      </div>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {isLoading ? (
        <SkeletonTable rows={5} />
      ) : prospects.length === 0 ? (
        <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">{t('prospects.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">{t('prospects.colName')}</th>
                <th className="px-5 py-3 font-medium">{t('prospects.colContact')}</th>
                <th className="px-5 py-3 font-medium">{t('prospects.colCity')}</th>
                <th className="px-5 py-3 font-medium">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {prospects.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900 dark:text-white">{p.first_name} {p.last_name}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                    {p.email && <div>{p.email}</div>}
                    {p.phone && <div>{p.phone}</div>}
                  </td>
                  <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{p.city ?? '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setConvertTarget(p)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-500/10"
                        title={t('prospects.becomeClient')}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                        title={t('common.edit')}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.last_page > 1 && (
        <Pagination currentPage={meta.current_page} lastPage={meta.last_page} total={meta.total} perPage={15} onPageChange={setPage} />
      )}

      {/* Create/Edit modal */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('prospects.editTitle') : t('prospects.createTitle')}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('prospects.firstName') + ' *'}
              value={form.first_name}
              onChange={(e) => setForm({ ...form, first_name: e.target.value })}
              error={fieldErrors.first_name}
            />
            <Input
              label={t('prospects.lastName') + ' *'}
              value={form.last_name}
              onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              error={fieldErrors.last_name}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('prospects.email')}
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              label={t('prospects.phone')}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('prospects.city')}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <Input
              label={t('prospects.country')}
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
          </div>
          <Input
            label={t('prospects.address')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('prospects.notes')}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={isSubmitting}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Convert confirmation modal */}
      <Modal
        isOpen={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        title={t('prospects.convertTitle')}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('prospects.convertMessage', { name: convertTarget ? `${convertTarget.first_name} ${convertTarget.last_name}` : '' })}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConvertTarget(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleConvert} disabled={isConverting}>{t('prospects.becomeClient')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
