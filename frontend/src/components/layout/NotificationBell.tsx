import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { Spinner } from '@/components/ui/Spinner';
import type { AppNotification } from '@/types/notification';

function formatAge(iso: string | null, t: TFunction): string {
  if (!iso) return '';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return t('notifications.justNow');
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('notifications.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  return t('notifications.daysAgo', { count: days });
}

function NotificationItem({
  notification,
  onOpen,
}: {
  notification: AppNotification;
  onOpen: (n: AppNotification) => void;
}) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
        notification.is_read ? 'opacity-70' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
          {notification.title}
        </span>
        {!notification.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
      </div>
      {notification.message && (
        <span className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
          {notification.message}
        </span>
      )}
      <span className="text-[11px] text-gray-400">
        {formatAge(notification.created_at, t)}
      </span>
    </button>
  );
}

export function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { items, unreadCount, loading, markRead, readAll } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  async function handleOpen(notification: AppNotification) {
    if (!notification.is_read) {
      await markRead(notification.id);
    }
    setIsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        aria-label={t('contextBar.notifications')}
      >
        <Bell className="h-4.5 w-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {t('notifications.title')}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={readAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-gray-400">
                <Inbox className="h-8 w-8" />
                <span className="text-sm">{t('notifications.empty')}</span>
              </div>
            ) : (
              items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onOpen={handleOpen}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
