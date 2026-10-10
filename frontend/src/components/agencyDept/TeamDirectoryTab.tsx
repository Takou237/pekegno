import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Plus, Trash2, UserCheck, UserPlus, UserX } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { canManageTeam } from '@/utils/agencyDeptPermissions';
import { formatCurrency } from '@/utils/number';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Alert';
import { Pagination } from '@/components/ui/Pagination';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Autocomplete } from '@/components/ui/Autocomplete';
import type { LaravelPage, TeamDirectoryMember } from '@/types/agencyDepartment';

const emptyForm = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  commission_type: 'none' as 'none' | 'percent' | 'fixed',
  commission_value: '',
  is_active: true,
};

/**
 * Annuaire des équipiers (calque employé) : création avec ou sans compte,
 * liaison / création de compte community-manager, commissions propres.
 */
export default function TeamDirectoryTab({ agencyId, departmentId }: { agencyId?: string; departmentId?: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const canManage = canManageTeam(user);

  const [result, setResult] = useState<LaravelPage<TeamDirectoryMember> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [linked, setLinked] = useState('');
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeamDirectoryMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [linkTarget, setLinkTarget] = useState<TeamDirectoryMember | null>(null);
  const [linkUserId, setLinkUserId] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TeamDirectoryMember | null>(null);

  const load = useCallback(() => {
    agencyDeptApi
      .teamMembers({
        agency_id: agencyId,
        department_id: departmentId,
        search: search || undefined,
        linked: linked || undefined,
        page,
        per_page: 15,
      })
      .then(setResult)
      .catch((e) => setError(extractErrorMessage(e, t('common.error'))));
  }, [agencyId, departmentId, search, linked, page, t]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(m: TeamDirectoryMember) {
    setEditing(m);
    setForm({
      first_name: m.first_name,
      last_name: m.last_name,
      email: m.email ?? '',
      phone: m.phone ?? '',
      commission_type: m.commission_type,
      commission_value: m.commission_value ? String(Number(m.commission_value)) : '',
      is_active: m.is_active,
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        agency_id: agencyId,
        department_id: departmentId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        commission_type: form.commission_type,
        commission_value: form.commission_value ? Number(form.commission_value) : null,
        is_active: form.is_active,
      };
      if (editing) await agencyDeptApi.updateTeamMember(editing.id, payload);
      else await agencyDeptApi.createTeamMember(payload);
      setFormOpen(false);
      setPage(1);
      load();
      showToast(t('agencyDept.saved'), 'success');
    } catch (err) {
      setFormError(extractErrorMessage(err, t('common.error')));
    } finally {
      setSaving(false);
    }
  }

  function openLink(m: TeamDirectoryMember) {
    setLinkTarget(m);
    setLinkUserId('');
    setAccountEmail(m.email ?? '');
    setLinkError(null);
  }

  async function userOptions(query: string) {
    const rows = await agencyDeptApi.teamMemberUsers({ agency_id: agencyId, search: query.trim() || undefined });
    return rows.map((u) => ({
      id: u.id,
      label: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || '',
      subtitle: u.email ?? undefined,
    }));
  }

  async function handleLink() {
    if (!linkTarget || !linkUserId) return;
    setLinkSaving(true);
    setLinkError(null);
    try {
      await agencyDeptApi.linkTeamMemberUser(linkTarget.id, linkUserId);
      setLinkTarget(null);
      load();
      showToast(t('agencyDept.saved'), 'success');
    } catch (err) {
      setLinkError(extractErrorMessage(err, t('common.error')));
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleCreateAccount() {
    if (!linkTarget || !accountEmail.trim()) return;
    setLinkSaving(true);
    setLinkError(null);
    try {
      await agencyDeptApi.createTeamMemberAccount(linkTarget.id, accountEmail.trim());
      setLinkTarget(null);
      load();
      showToast(t('agencyDept.saved'), 'success');
    } catch (err) {
      setLinkError(extractErrorMessage(err, t('common.error')));
    } finally {
      setLinkSaving(false);
    }
  }

  async function handleUnlink(m: TeamDirectoryMember) {
    try {
      await agencyDeptApi.unlinkTeamMemberUser(m.id);
      load();
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await agencyDeptApi.deleteTeamMember(deleteTarget.id);
      setDeleteTarget(null);
      load();
      showToast(t('agencyDept.deleted'), 'success');
    } catch (err) {
      showToast(extractErrorMessage(err, t('common.error')), 'error');
    }
  }

  function commissionLabel(m: TeamDirectoryMember): string {
    if (m.commission_type === 'percent' && m.commission_value != null) return `${Number(m.commission_value)} %`;
    if (m.commission_type === 'fixed' && m.commission_value != null) return formatCurrency(m.commission_value);
    return t('agencyDept.team.noCommission');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.team.directorySubtitle')}</p>
        {canManage && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t('agencyDept.team.newMember')}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-60 flex-1">
          <Input placeholder={t('common.search')} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <Select value={linked} onChange={(e) => { setLinked(e.target.value); setPage(1); }}>
          <option value="">{t('common.all')}</option>
          <option value="true">{t('agencyDept.team.withAccount')}</option>
          <option value="false">{t('agencyDept.team.withoutAccount')}</option>
        </Select>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        {!result ? (
          <SkeletonTable />
        ) : result.data.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.team.memberEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.team.member')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 font-medium">{t('agencyDept.team.commission')}</th>
                  {canManage && <th className="px-4 py-3 font-medium">{t('common.actions')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {result.data.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {m.first_name} {m.last_name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {[m.email, m.phone].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {m.user ? (
                          <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <UserCheck className="h-3.5 w-3.5" /> {m.user.email ?? t('agencyDept.team.withAccount')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <UserX className="h-3.5 w-3.5" /> {t('agencyDept.team.withoutAccount')}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${m.is_active ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                        {t(m.is_active ? 'common.active' : 'common.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{commissionLabel(m)}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(m)} title={t('common.edit')}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!m.user_id && (
                            <Button size="sm" variant="outline" onClick={() => openLink(m)} title={t('agencyDept.team.linkAccount')}>
                              <UserPlus className="h-4 w-4" />
                            </Button>
                          )}
                          {m.user_id && (
                            <Button size="sm" variant="ghost" onClick={() => handleUnlink(m)} title={t('agencyDept.team.unlinkAccount')}>
                              <UserX className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(m)} title={t('common.delete')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {result && result.last_page > 1 && (
        <Pagination currentPage={result.current_page} lastPage={result.last_page} total={result.total} perPage={result.per_page} onPageChange={setPage} />
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={t(editing ? 'agencyDept.team.editMember' : 'agencyDept.team.newMember')} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          {formError && <Alert variant="error">{formError}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label={t('common.firstName')} required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <Input label={t('common.lastName')} required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label={t('common.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Select label={t('agencyDept.team.commission')} value={form.commission_type} onChange={(e) => setForm({ ...form, commission_type: e.target.value as typeof form.commission_type })}>
              <option value="none">{t('agencyDept.team.noCommission')}</option>
              <option value="percent">%</option>
              <option value="fixed">{t('agencyDept.prestations.fixedAmount')}</option>
            </Select>
            <Input label={t('agencyDept.prestations.commissionValue')} type="number" min={0} disabled={form.commission_type === 'none'} value={form.commission_value} onChange={(e) => setForm({ ...form, commission_value: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {t('common.active')}
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" isLoading={saving}>{t('common.save')}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!linkTarget} onClose={() => setLinkTarget(null)} title={`${t('agencyDept.team.linkAccount')} — ${linkTarget?.first_name} ${linkTarget?.last_name}`} maxWidth="max-w-lg">
        <div className="flex flex-col gap-4">
          {linkError && <Alert variant="error">{linkError}</Alert>}
          <div>
            <Autocomplete
              label={t('agencyDept.team.linkAccount')}
              placeholder={t('common.search')}
              value={linkUserId}
              onChange={setLinkUserId}
              fetchOptions={userOptions}
            />
            <div className="mt-2 flex justify-end">
              <Button type="button" onClick={handleLink} isLoading={linkSaving} disabled={!linkUserId}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t('agencyDept.team.createAccount')}</p>
            <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">{t('agencyDept.team.createAccountHint')}</p>
            <div className="flex gap-2">
              <Input type="email" required placeholder={t('agencyDept.team.accountEmail')} value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)} />
              <Button type="button" onClick={handleCreateAccount} isLoading={linkSaving} disabled={!accountEmail.trim()}>
                {t('common.create')}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('common.delete')}
        message={t('agencyDept.deleted')}
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
