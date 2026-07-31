import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usersApi } from '@/api/users.api';
import { Spinner } from '@/components/ui/Spinner';
import { Alert } from '@/components/ui/Alert';
import { extractErrorMessage } from '@/api/errors';
import type { RoleListItem, Permission } from '@/types/user';

const PERMISSION_KEYS: Record<string, string> = {
  creer: 'privileges.permissionCreate',
  modifier: 'privileges.permissionEdit',
  supprimer: 'privileges.permissionDelete',
  exporter: 'privileges.permissionExport',
  consulter: 'privileges.permissionView',
  imprimer: 'privileges.permissionPrint',
  valider: 'privileges.permissionValidate',
  encaisser: 'privileges.permissionCash',
  annuler: 'privileges.permissionCancel',
};

export default function RolesPrivilegesPage() {
  const { t } = useTranslation();
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    usersApi
      .listRoles()
      .then(setRoles)
      .catch((err) => setError(extractErrorMessage(err, t('privileges.loadFailed'))))
      .finally(() => setIsLoading(false));
  }, [t]);

  const allPermissions = [
    'creer',
    'modifier',
    'supprimer',
    'exporter',
    'consulter',
    'imprimer',
    'valider',
    'encaisser',
    'annuler',
  ];

  const permissionSet = (role: RoleListItem): Set<string> =>
    new Set((role.permissions ?? []).map((p: Permission) => p.name));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
          <Shield className="h-5 w-5" />
          {t('privileges.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('privileges.subtitle')}
        </p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left font-medium text-gray-500">{t('privileges.colRole')}</th>
                {allPermissions.map((perm) => (
                  <th
                    key={perm}
                    className="px-3 py-3 text-center font-medium text-gray-500"
                  >
                    <span className="text-xs uppercase">
                      {t(PERMISSION_KEYS[perm] ?? perm)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {roles.map((role) => {
                const perms = permissionSet(role);
                return (
                  <tr key={role.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {t(`roles.${role.name}`, { defaultValue: role.name })}
                    </td>
                    {allPermissions.map((perm) => (
                      <td key={perm} className="px-3 py-3 text-center">
                        {perms.has(perm) ? (
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs text-green-600 dark:bg-green-900/30 dark:text-green-400">
                            ✓
                          </span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
