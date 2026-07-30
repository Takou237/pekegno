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
  const assignments = user?.assignments?.filter((a: any) => a.pivot?.is_primary === true) ?? [];
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assignments.length === 0) { setLoading(false); return; }
    client.get(`/agencies/${assignments[0].id}`)
      .then(({ data }) => setAgency(data.data ?? data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [assignments]);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!agency) return <p className="text-sm text-gray-400">Aucune agence assignée.</p>;

  const deptCount = agency.departments?.length ?? 0;
  const userCount = agency.assigned_users?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{agency.name}</h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
          {agency.code}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link to={`/departments?agency_id=${agency.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{deptCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Départements</p>
            </div>
          </div>
        </Link>
        <Link to={`/users?agency_id=${agency.id}`} className="rounded-2xl border border-gray-100 bg-white p-5 transition hover:shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{userCount}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</p>
            </div>
          </div>
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{agency.country}</p>
              <p className="text-xs text-gray-400">{agency.city ?? '—'}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-1 text-sm font-semibold text-gray-500 uppercase tracking-wide">Informations</h2>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div><span className="text-gray-400">Adresse :</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.full_address ?? '—'}</span></div>
          <div><span className="text-gray-400">Téléphone :</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.phone ?? '—'}</span></div>
          <div><span className="text-gray-400">Email :</span><br /><span className="text-gray-800 dark:text-gray-100">{agency.email ?? '—'}</span></div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Départements ({deptCount})
        </h2>
        {deptCount > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {agency.departments?.map((d) => (
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

      <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Utilisateurs ({userCount})
        </h2>
        {userCount > 0 ? (
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
                {agency.assigned_users?.map((u: any) => (
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
    </div>
  );
}

function DeptChiefDashboard() {
  const { user } = useAuth();
  const deptChiefAssignments = (user?.assignments ?? []).filter(
    (a: any) => a.pivot?.is_department_chief === true
  );
  const [depts, setDepts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (deptChiefAssignments.length === 0) { setLoading(false); return; }
    client.get('/departments?per_page=100')
      .then(({ data }) => setDepts(data.data ?? data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (depts.length === 0) return <p className="text-sm text-gray-400">Aucun département assigné.</p>;

  const totalUsers = depts.reduce((sum, d) => sum + (d.user_count ?? d.assigned_users?.length ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Mes départements</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{depts.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Départements</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{depts[0]?.agency?.name ?? '—'}</p>
              <p className="text-xs text-gray-400">Agence rattachée</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {depts.map((d) => (
          <div key={d.id} className="rounded-2xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">{d.name}</h2>
                <p className="text-xs text-gray-400">{d.description ?? d.agency?.name ?? '—'}</p>
              </div>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
                {d.user_count ?? d.assigned_users?.length ?? 0} utilisateur{(d.user_count ?? d.assigned_users?.length ?? 0) > 1 ? 's' : ''}
              </span>
            </div>
            <Link
              to={`/users?department_id=${d.id}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              <Users className="h-4 w-4" />
              Voir les utilisateurs
            </Link>
          </div>
        ))}
      </div>
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
