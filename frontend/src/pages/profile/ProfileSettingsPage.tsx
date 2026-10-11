import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { AccountSettingsSections } from '@/components/profile/AccountSettingsSections';

export default function ProfileSettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          to="/profile"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('profile.title')}
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">{t('profile.settingsTitle')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fullName} — {user.email}
        </p>
      </div>

      <AccountSettingsSections />
    </div>
  );
}
