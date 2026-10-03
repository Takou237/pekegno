import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';
import { agencyApi, type ClientNotification } from '@/api/agency.api';
import { formatDate } from '@/utils';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';

/** Notifications du portail client (ex. rappels de renouvellement de contrat). */
export default function NotificationsPage() {
  const { t } = useTranslation();
  const [items, setItems] = useState<ClientNotification[] | null>(null);

  const load = useCallback(() => {
    agencyApi.notifications().then((r) => setItems(r.data)).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!items) return <Spinner className="py-20" />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('agency.notifications')}</h1>
        {items.some((n) => !n.read_at) && (
          <Button size="sm" variant="outline" onClick={() => agencyApi.markAllRead().then(load)}>{t('agency.markAllRead')}</Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-gray-500 shadow-sm border border-gray-100">{t('agency.noNotifications')}</div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              onClick={() => !n.read_at && agencyApi.markRead(n.id).then(load)}
              className={`bg-white rounded-xl p-4 shadow-sm border flex gap-3 ${n.read_at ? 'border-gray-100' : 'border-brand-200 cursor-pointer'}`}
            >
              <Bell size={18} className={n.read_at ? 'text-gray-300' : 'text-brand-600'} />
              <div className="min-w-0">
                <p className={`text-sm ${n.read_at ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>{n.title}</p>
                {n.body && <p className="text-sm text-gray-500 mt-0.5">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-1">{formatDate(n.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
