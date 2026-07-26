import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import type { Agency } from '@/types/agency';

export function AgencyDetailModal({
  agency,
  onClose,
}: {
  agency: Agency | null;
  onClose: () => void;
}) {
  if (!agency) {
    return null;
  }

  return (
    <Modal isOpen={Boolean(agency)} onClose={onClose} title={agency.name} maxWidth="max-w-2xl">
      <div className="flex flex-col gap-5">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Code</dt>
            <dd className="text-sm text-gray-800 dark:text-gray-100">{agency.code}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Pays</dt>
            <dd className="text-sm text-gray-800 dark:text-gray-100">{agency.country}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Adresse</dt>
            <dd className="text-sm text-gray-800 dark:text-gray-100">
              {agency.full_address ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Téléphone</dt>
            <dd className="text-sm text-gray-800 dark:text-gray-100">{agency.phone ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-400">Email</dt>
            <dd className="text-sm text-gray-800 dark:text-gray-100">{agency.email ?? '—'}</dd>
          </div>
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">
            Départements ({agency.departments?.length ?? 0})
          </p>
          {(agency.departments?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Aucun département.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(agency.departments ?? []).map((department) => (
                <Badge key={department.id} variant="brand">
                  {department.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase text-gray-400">
            Utilisateurs assignés ({agency.assigned_users?.length ?? 0})
          </p>
          {(agency.assigned_users?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aucun utilisateur assigné.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(agency.assigned_users ?? []).map((assignedUser) => (
                <li key={assignedUser.id} className="text-sm text-gray-700 dark:text-gray-200">
                  {assignedUser.name ?? assignedUser.email}{' '}
                  <span className="text-gray-400">— {assignedUser.email}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
