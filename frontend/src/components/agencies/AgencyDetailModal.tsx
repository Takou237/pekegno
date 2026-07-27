import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { agenciesApi } from '@/api/agencies.api';
import type { Agency } from '@/types/agency';

export function AgencyDetailModal({
  agency,
  onClose,
}: {
  agency: Agency | null;
  onClose: () => void;
}) {
  const [fullAgency, setFullAgency] = useState<Agency | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!agency) {
      setFullAgency(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    agenciesApi
      .get(agency.id)
      .then((data) => {
        if (!cancelled) {
          setFullAgency(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFullAgency(agency);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agency?.id]);

  if (!agency) {
    return null;
  }

  const display = fullAgency ?? agency;

  return (
    <Modal isOpen={Boolean(agency)} onClose={onClose} title={agency.name} maxWidth="max-w-2xl">
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase text-gray-400">Code</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-100">{display.code}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-400">Pays</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-100">{display.country}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-400">Adresse</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-100">
                {display.full_address ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-400">Téléphone</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-100">{display.phone ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-gray-400">Email</dt>
              <dd className="text-sm text-gray-800 dark:text-gray-100">{display.email ?? '—'}</dd>
            </div>
          </dl>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">
              Départements ({display.departments?.length ?? 0})
            </p>
            {(display.departments?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun département.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(display.departments ?? []).map((department) => (
                  <Badge key={department.id} variant="brand">
                    {department.name}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase text-gray-400">
              Utilisateurs assignés ({display.assigned_users?.length ?? 0})
            </p>
            {(display.assigned_users?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Aucun utilisateur assigné.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {(display.assigned_users ?? []).map((assignedUser) => (
                  <li key={assignedUser.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                    {assignedUser.pivot?.is_primary && (
                      <Badge variant="warning">Chef</Badge>
                    )}
                    <span>{assignedUser.name ?? assignedUser.email}</span>
                    <span className="text-gray-400">— {assignedUser.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
