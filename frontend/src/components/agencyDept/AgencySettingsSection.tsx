import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ChevronRight, HandCoins, Plus, Trash2, Wand2 } from 'lucide-react';
import { agencyDeptApi } from '@/api/agencyDepartment.api';
import { extractErrorMessage } from '@/api/errors';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { canManagePackages, canManageTeam } from '@/utils/agencyDeptPermissions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { AgencyCategory, AgencyCategoryKind, ClientTeamRole } from '@/types/agencyDepartment';

/**
 * Paramètres propres au département Agency : délais d'alerte de renouvellement
 * (D8), catégories de packages / prestations (D2), rôles de l'équipe client.
 */
export function AgencySettingsSection({ departmentId }: { departmentId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [days, setDays] = useState('');
  const [categories, setCategories] = useState<AgencyCategory[]>([]);
  const [roles, setRoles] = useState<ClientTeamRole[]>([]);
  const [newCat, setNewCat] = useState<Record<AgencyCategoryKind, string>>({ package: '', prestation: '' });
  const [newRole, setNewRole] = useState('');

  const load = useCallback(() => {
    agencyDeptApi.settings(departmentId).then((s) => setDays(s.renew_alert_days.join(', '))).catch(() => {});
    agencyDeptApi.categories({ department_id: departmentId }).then(setCategories).catch(() => {});
    agencyDeptApi.teamRoles({ department_id: departmentId }).then(setRoles).catch(() => {});
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const guard = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      showToast(t('agencyDept.saved'), 'success');
      load();
    } catch (e) {
      showToast(extractErrorMessage(e, t('common.error')), 'error');
    }
  };

  const saveDays = () =>
    guard(() => agencyDeptApi.updateSettings(departmentId, days.split(/[,\s;]+/).filter(Boolean).map(Number).filter((n) => !Number.isNaN(n))));

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('agencyDept.settings.title')}</h2>

      {/* Commissions : retirées du menu latéral, accessibles depuis les paramètres. */}
      <Link
        to={`/departments/${departmentId}/commissions`}
        className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          <HandCoins className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900 dark:text-white">{t('nav.commissions')}</span>
          <span className="mt-0.5 block text-sm text-gray-500 dark:text-gray-400">{t('agencyDept.commissions.subtitle')}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
      </Link>

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="font-semibold text-gray-900 dark:text-white">{t('agencyDept.settings.alertDays')}</h3>
        <p className="mb-3 text-sm text-gray-500">{t('agencyDept.settings.alertDaysHint')}</p>
        <div className="flex gap-2">
          <Input value={days} onChange={(e) => setDays(e.target.value)} placeholder="30, 15, 7, 1" />
          <Button onClick={saveDays}>{t('common.save')}</Button>
        </div>
      </section>

      {(['package', 'prestation'] as AgencyCategoryKind[]).map((kind) => (
        <section key={kind} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-3 font-semibold text-gray-900 dark:text-white">{t(`agencyDept.settings.categories.${kind}`)}</h3>
          <ul className="mb-3 flex flex-wrap gap-2">
            {categories.filter((c) => c.kind === kind).map((c) => (
              <li key={c.id} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {c.name}
                {canManagePackages(user) && (
                  <button type="button" onClick={() => guard(() => agencyDeptApi.deleteCategory(c.id))} className="text-gray-400 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                )}
              </li>
            ))}
          </ul>
          {canManagePackages(user) && (
            <div className="flex gap-2">
              <Input placeholder={t('agencyDept.newCategory')} value={newCat[kind]} onChange={(e) => setNewCat({ ...newCat, [kind]: e.target.value })} />
              <Button
                variant="outline"
                disabled={!newCat[kind].trim()}
                onClick={() => guard(async () => {
                  await agencyDeptApi.createCategory({ kind, name: newCat[kind].trim(), department_id: departmentId });
                  setNewCat({ ...newCat, [kind]: '' });
                })}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      ))}

      <section className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">{t('agencyDept.settings.teamRoles')}</h3>
          {canManageTeam(user) && (
            <Button size="sm" variant="outline" onClick={() => guard(() => agencyDeptApi.seedTeamRoles(departmentId))}>
              <Wand2 className="h-4 w-4" /> {t('agencyDept.settings.seedRoles')}
            </Button>
          )}
        </div>
        <p className="mb-3 text-sm text-gray-500">{t('agencyDept.settings.teamRolesHint')}</p>
        <ul className="mb-3 flex flex-wrap gap-2">
          {roles.map((r) => (
            <li key={r.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              {r.name} {r.members_count ? <span className="text-xs opacity-70">({r.members_count})</span> : null}
              {canManageTeam(user) && (
                <button type="button" onClick={() => guard(() => agencyDeptApi.deleteTeamRole(r.id))} className="opacity-60 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </li>
          ))}
        </ul>
        {canManageTeam(user) && (
          <div className="flex gap-2">
            <Input placeholder={t('agencyDept.settings.newRole')} value={newRole} onChange={(e) => setNewRole(e.target.value)} />
            <Button
              variant="outline"
              disabled={!newRole.trim()}
              onClick={() => guard(async () => {
                await agencyDeptApi.createTeamRole({ name: newRole.trim(), department_id: departmentId });
                setNewRole('');
              })}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
