import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, KeyRound, Monitor, ShieldCheck } from 'lucide-react';
import { securityApi } from '@/api/security.api';
import { extractErrorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import type { SecurityCenter } from '@/types/security';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function Card({
  title,
  hint,
  icon,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
      <header className="mb-4 flex items-start gap-3">
        <span className="text-primary-600 dark:text-primary-400">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          {hint ? <p className="text-sm text-gray-500 dark:text-gray-400">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export default function SecurityCenterPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<SecurityCenter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    securityApi
      .center()
      .then(setData)
      .catch((err) => setError(extractErrorMessage(err, t('security.loadFailed'))));
  }, [t]);

  if (error) {
    return <Alert variant="error">{error}</Alert>;
  }

  if (!data) {
    return <SkeletonTable rows={6} />;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          <ShieldCheck className="h-5 w-5" />
          {t('security.title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('security.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={data.environment.staging ? 'warning' : 'success'}>
          {t('security.environment')}: {data.environment.app_env}
        </Badge>
        <Badge variant={data.environment.debug ? 'error' : 'neutral'}>
          {data.environment.debug ? t('security.debugOn') : t('security.debugOff')}
        </Badge>
      </div>

      {data.alerts.length > 0 ? (
        <Alert variant="info">
          <ul className="list-disc space-y-1 pl-4">
            {data.alerts.map((alert) => (
              <li key={alert}>{alert}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <Alert variant="success">{t('security.noAlerts')}</Alert>
      )}

      <Card title={t('security.sessions')} hint={t('security.sessionsHint')} icon={<Monitor className="h-5 w-5" />}>
        {data.sessions.length === 0 ? (
          <p className="text-sm text-gray-500">{t('security.noSessions')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="py-2 pr-4">{t('security.colUser')}</th>
                  <th className="py-2 pr-4">{t('security.colRole')}</th>
                  <th className="py-2 pr-4">{t('security.colToken')}</th>
                  <th className="py-2 pr-4">{t('security.colCreated')}</th>
                  <th className="py-2">{t('security.colLastUsed')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.sessions.map((session) => (
                  <tr key={session.id}>
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{session.user.name}</div>
                      <div className="text-xs text-gray-500">{session.user.email}</div>
                    </td>
                    <td className="py-2 pr-4">{session.user.role ?? '—'}</td>
                    <td className="py-2 pr-4">{session.token_name}</td>
                    <td className="py-2 pr-4">{formatDate(session.created_at)}</td>
                    <td className="py-2">{formatDate(session.last_used_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={t('security.privileged')}
        hint={t('security.privilegedHint')}
        icon={<KeyRound className="h-5 w-5" />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 dark:text-gray-400">
              <tr>
                <th className="py-2 pr-4">{t('security.colUser')}</th>
                <th className="py-2 pr-4">{t('security.colRole')}</th>
                <th className="py-2 pr-4">{t('security.col2fa')}</th>
                <th className="py-2 pr-4">{t('security.colActive')}</th>
                <th className="py-2">{t('security.colLastLogin')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {data.privileged_accounts.map((account) => (
                <tr key={account.id}>
                  <td className="py-2 pr-4">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{account.name}</div>
                    <div className="text-xs text-gray-500">{account.email}</div>
                  </td>
                  <td className="py-2 pr-4">{account.role ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={account.two_factor_enabled ? 'success' : 'error'}>
                      {account.two_factor_enabled ? t('security.enabled') : t('security.disabled')}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Badge variant={account.is_active ? 'success' : 'neutral'}>
                      {account.is_active ? t('security.active') : t('security.inactive')}
                    </Badge>
                  </td>
                  <td className="py-2">{formatDate(account.last_login_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card
        title={t('security.developers')}
        hint={t('security.developersHint')}
        icon={<AlertTriangle className="h-5 w-5" />}
      >
        {data.developer_access.length === 0 ? (
          <p className="text-sm text-gray-500">{t('security.noDevelopers')}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.developer_access.map((access) => (
              <li key={access.email} className="flex items-center justify-between gap-3">
                <span>{access.email}</span>
                <Badge variant={access.user ? 'warning' : 'neutral'}>
                  {access.user ? t('security.hasAccount') : t('security.noAccount')}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card
        title={t('security.recentEvents')}
        hint={t('security.recentEventsHint')}
        icon={<ShieldCheck className="h-5 w-5" />}
      >
        {data.recent_events.length === 0 ? (
          <p className="text-sm text-gray-500">{t('security.noEvents')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 text-sm dark:divide-gray-800">
            {data.recent_events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{event.action}</span>
                  {event.description ? (
                    <span className="ml-2 text-gray-500 dark:text-gray-400">{event.description}</span>
                  ) : null}
                </div>
                <div className="text-xs text-gray-500">
                  {event.user?.email ?? '—'} · {event.ip_address ?? '—'} · {formatDate(event.created_at)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
