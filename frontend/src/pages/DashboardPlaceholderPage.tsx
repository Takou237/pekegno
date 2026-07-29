import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FolderTree, Users, Mail, Phone, BadgeInfo } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { client } from '@/api/client';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import type { Agency } from '@/types/agency';

const ADMIN_ROLES = ['super-admin', 'direction-generale'];

function roleBadge(roleName: string | null | undefined) {
  switch (roleName) {
    case 'super-admin': return <Badge variant="error">Super Admin</Badge>;
    case 'direction-generale': return <Badge variant="brand">Direction</Badge>;
    case 'responsable-agence': return <Badge variant="warning">Resp. Agence</Badge>;
    case 'responsable-departement': return <Badge variant="warning">Resp. Dép.</Badge>;
    case 'commercial': return <Badge variant="success">Commercial</Badge>;
    case 'caissier': return <Badge variant="neutral">Caissier</Badge>;
    case 'comptable': return <Badge variant="neutral">Comptable</Badge>;
    case 'formateur': return <Badge variant="brand">Formateur</Badge>;
    default: return <Badge variant="neutral">Sans rôle</Badge>;
  }
}

function AdminDashboard() {
  const [stats, setStats] = useState<{ agencies: number; departments: number; users: number } | null>(null);

  useEffect(() => {
    Promise.all([
      client.get('/agencies', { params: { per_page: 1 } }),
      client.get('/departments', { params: { per_page: 1 } }),
      client.get('/users', { params: { per_page: 1 } }),
    ]).then(([a, d, u]) => {
      setStats({
        agencies: a.data.meta?.total ?? 0,
        departments: d.data.meta?.total ?? 0,
        users: u.data.meta?.total ?? 0,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Tableau de bord</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to="/agencies" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.agencies ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Agences</p>
            </div>
          </div>
        </Link>
        <Link to="/departments" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.departments ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Départements</p>
            </div>
          </div>
        </Link>
        <Link to="/users" className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.users ?? '—'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function AgencyChiefDashboard() {
  const { user } = useAuth();
  const assignment = user?.assignments?.find((a: any) => a.pivot?.is_primary === true);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!assignment?.id) { setLoading(false); return; }
    client.get(`/agencies/${assignment.id}`)
      .then(({ data }) => setAgency(data.data ?? data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignment?.id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Tableau de bord — {agency?.name ?? 'Agence'}
      </h1>

      {agency && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-semibold text-gray-500 uppercase tracking-wide">Agence</h2>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{agency.name}</p>
          <p className="text-sm text-gray-500">{agency.code} — {agency.city ?? agency.country}</p>
        </div>
      )}

      {agency && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Départements ({agency.departments?.length ?? 0})
          </h2>
          {agency.departments && agency.departments.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {agency.departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{d.name}</span>
                  <span className="text-xs text-gray-400">{d.description ?? '—'}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun département.</p>
          )}
        </div>
      )}

      {agency && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Utilisateurs de l'agence ({agency.assigned_users?.length ?? 0})
          </h2>
          {agency.assigned_users && agency.assigned_users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <th className="pb-2 pr-4 font-medium">Nom</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 font-medium">Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {agency.assigned_users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{u.email}</td>
                      <td className="py-2.5">{roleBadge(u.role?.name)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun utilisateur assigné.</p>
          )}
        </div>
      )}
    </div>
  );
}

function DeptChiefDashboard() {
  const { user } = useAuth();
  const deptAssignment = user?.assignments?.find((a: any) => a.pivot?.is_department_chief === true);
  const [dept, setDept] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deptAssignment?.pivot?.department_id) { setLoading(false); return; }
    client.get(`/departments/${deptAssignment.pivot.department_id}`)
      .then(({ data }) => setDept(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [deptAssignment?.pivot?.department_id]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Tableau de bord — {dept?.name ?? 'Département'}
      </h1>

      {dept && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-1 text-sm font-semibold text-gray-500 uppercase tracking-wide">Département</h2>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{dept.name}</p>
          <p className="text-sm text-gray-500">{dept.agency?.name ?? '—'}</p>
        </div>
      )}

      {dept && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Utilisateurs ({dept.assigned_users?.length ?? 0})
          </h2>
          {dept.assigned_users && dept.assigned_users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase text-gray-400 dark:border-gray-800">
                    <th className="pb-2 pr-4 font-medium">Nom</th>
                    <th className="pb-2 pr-4 font-medium">Email</th>
                    <th className="pb-2 font-medium">Rôle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {dept.assigned_users.map((u: any) => (
                    <tr key={u.id}>
                      <td className="py-2.5 pr-4 font-medium text-gray-800 dark:text-gray-100">{u.name}</td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{u.email}</td>
                      <td className="py-2.5">{roleBadge(u.role?.name)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun utilisateur assigné.</p>
          )}
        </div>
      )}
    </div>
  );
}

function UserDashboard() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
        Bienvenue, {user?.first_name ?? user?.username}
      </h1>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-sm font-semibold text-gray-500 uppercase tracking-wide">Mon profil</h2>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-sm">
            <BadgeInfo className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{user?.name}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">{user?.email}</span>
          </div>
          {user?.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-gray-400" />
              <span className="text-gray-600 dark:text-gray-300">{user?.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-400">Rôle :</span>
            {roleBadge(user?.role?.name)}
          </div>
        </div>
      </div>

      {user?.assignments && user.assignments.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">Mes affectations</h2>
          <div className="flex flex-col gap-2">
            {user.assignments.map((a: any) => (
              <div key={a.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm dark:border-gray-800 dark:bg-gray-800/50">
                <p className="font-medium text-gray-800 dark:text-gray-100">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.pivot?.is_primary ? 'Chef d\'agence' : ''}
                  {a.pivot?.is_department_chief ? 'Chef de département' : ''}
                  {!a.pivot?.is_primary && !a.pivot?.is_department_chief ? 'Membre' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const roleName = user?.role?.name;

  if (ADMIN_ROLES.includes(roleName ?? '')) {
    return <AdminDashboard />;
  }
  if (roleName === 'responsable-agence') {
    return <AgencyChiefDashboard />;
  }
  if (roleName === 'responsable-departement') {
    return <DeptChiefDashboard />;
  }
  return <UserDashboard />;
}
