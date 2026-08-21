import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2, BadgeCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { academyApi, type Trainer } from '@/api/academy.api';
import { extractErrorMessage, extractFieldErrors } from '@/api/errors';
import { useToast } from '@/hooks/useToast';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { Agency } from '@/types/agency';

interface AgencyLayoutContext {
  agency: Agency | null;
  agencyId?: string;
}

interface AvailableUser {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active: boolean;
}

interface FormState {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  bio: string;
  linked_user_id: string;
}

const emptyForm: FormState = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  bio: '',
  linked_user_id: '',
};

export default function AcademyTrainersPage() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { agencyId, countryId } = useParams<{ agencyId: string; countryId?: string }>();
  const outlet = useOutletContext<AgencyLayoutContext>();
  const effectiveAgencyId = agencyId ?? outlet.agencyId;

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Trainer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fetchTrainers = useCallback(async () => {
    if (!effectiveAgencyId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await academyApi.trainers({
        agency_id: effectiveAgencyId,
        search: search || undefined,
        per_page: 100,
      });
      setTrainers(response.data);
    } catch (error) {
      setLoadError(extractErrorMessage(error, t('academy.loadFailed')));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveAgencyId, search, t]);

  useEffect(() => {
    const timeout = setTimeout(fetchTrainers, 350);
    return () => clearTimeout(timeout);
  }, [fetchTrainers]);

  // Comptes « formateur » pas encore liés à un profil : liables à la création.
  const linkableUserOptions = useCallback(async (query: string) => {
    const users: AvailableUser[] = await academyApi.availableUsers();
    const q = query.trim().toLowerCase();
    return users
      .filter((u) =>
        q
          ? `${u.first_name ?? ''} ${u.last_name ?? ''} ${u.email}`.toLowerCase().includes(q)
          : true,
      )
      .map((u) => ({
        id: u.id,
        label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
        subtitle: u.email,
      }));
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  function openEdit(trainer: Trainer) {
    setEditing(trainer);
    setForm({
      first_name: trainer.first_name ?? '',
      last_name: trainer.last_name ?? '',
      email: trainer.email ?? '',
      phone: trainer.phone ?? '',
      bio: trainer.bio ?? '',
      linked_user_id: '',
    });
    setFormError(null);
    setFieldErrors({});
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!effectiveAgencyId) return;
    if (!form.first_name.trim() && !form.last_name.trim()) return;
    setFormError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    const payload = {
      first_name: form.first_name || null,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      bio: form.bio || null,
      agency_id: effectiveAgencyId,
    };

    try {
      if (editing) {
        const saved = await academyApi.updateTrainer(editing.id, payload);
        if (!editing.has_account && form.linked_user_id) {
          await academyApi.linkTrainerUser(saved.id, form.linked_user_id);
        }
        setTrainers((prev) => prev.map((tr) => (tr.id === saved.id ? saved : tr)));
      } else {
        const saved = await academyApi.createTrainer(payload);
        if (form.linked_user_id) {
          const linked = await academyApi.linkTrainerUser(saved.id, form.linked_user_id);
          setTrainers((prev) => [linked, ...prev]);
        } else {
          setTrainers((prev) => [saved, ...prev]);
        }
      }
      showToast(t('academy.saved'), 'success');
      setFormOpen(false);
    } catch (error) {
      setFormError(extractErrorMessage(error, t('academy.saveFailed')));
      setFieldErrors(extractFieldErrors(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(trainer: Trainer) {
    if (!window.confirm(t('academy.deleteTrainerConfirm'))) return;
    try {
      await academyApi.removeTrainer(trainer.id);
      setTrainers((prev) => prev.filter((tr) => tr.id !== trainer.id));
      showToast(t('academy.trainerDeleted'), 'success');
    } catch (error) {
      showToast(extractErrorMessage(error, t('academy.deleteFailed')), 'error');
    }
  }

  function openTrainer(trainer: Trainer) {
    navigate(
      countryId
        ? `/countries/${countryId}/agencies/${agencyId}/academy/trainers/${trainer.id}`
        : `/agencies/${agencyId}/academy/trainers/${trainer.id}`,
    );
  }

  function trainerName(trainer: Trainer): string {
    return (
      [trainer.first_name, trainer.last_name].filter(Boolean).join(' ') ||
      trainer.email ||
      '—'
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('nav.trainers')}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('academy.trainersSubtitle')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {t('academy.newTrainer')}
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('academy.searchTrainerPlaceholder')}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm text-gray-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {isLoading ? (
          <SkeletonTable rows={5} />
        ) : loadError ? (
          <p className="p-6 text-sm text-error-500">{loadError}</p>
        ) : trainers.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">{t('academy.noTrainers')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-5 py-3 font-medium">{t('users.colName')}</th>
                  <th className="px-5 py-3 font-medium">{t('users.colEmail')}</th>
                  <th className="px-5 py-3 font-medium">{t('users.colPhone')}</th>
                  <th className="px-5 py-3 font-medium">{t('nav.sessions')}</th>
                  <th className="px-5 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {trainers.map((trainer) => (
                  <tr
                    key={trainer.id}
                    onClick={() => openTrainer(trainer)}
                    className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-50 text-sm font-medium text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
                          {trainerName(trainer).charAt(0).toUpperCase()}
                        </span>
                        <span className="flex items-center gap-1.5 font-medium text-gray-800 dark:text-gray-100">
                          {trainerName(trainer)}
                          {trainer.has_account && (
                            <span title={t('academy.hasAccount')}>
                              <BadgeCheck className="h-4 w-4 text-brand-500" />
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {trainer.email ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {trainer.phone ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-300">
                      {trainer.sessions_count ?? 0}
                    </td>
                    <td className="px-5 py-3">
                      {trainer.is_active ? (
                        <Badge variant="success">{t('common.active')}</Badge>
                      ) : (
                        <Badge variant="neutral">{t('common.inactive')}</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(trainer);
                          }}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-brand-600 dark:hover:bg-gray-800"
                          title={t('common.edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(trainer);
                          }}
                          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-gray-800"
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
      </div>

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t('academy.editTrainer') : t('academy.newTrainer')}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {formError && <Alert variant="error">{formError}</Alert>}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={t('common.firstName')}
              value={form.first_name}
              onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
              error={fieldErrors.first_name}
            />
            <Input
              label={t('common.lastName')}
              value={form.last_name}
              onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
              error={fieldErrors.last_name}
            />
          </div>

          <Input
            label={t('common.email')}
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            error={fieldErrors.email}
          />

          <Input
            label={t('common.phone')}
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            error={fieldErrors.phone}
          />

          {!editing?.has_account && (
            <Autocomplete
              label={t('academy.linkAccount')}
              placeholder={t('academy.linkAccountPlaceholder')}
              value={form.linked_user_id}
              onChange={(userId) => setForm((prev) => ({ ...prev, linked_user_id: userId }))}
              fetchOptions={linkableUserOptions}
            />
          )}

          <p className="text-xs text-gray-400 dark:text-gray-500">{t('academy.trainerNoAccountHint')}</p>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={isSubmitting} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="flex-1">
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
