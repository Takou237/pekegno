import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { commercialsApi } from '@/api/commercials.api';
import { AccountSettingsSections } from '@/components/profile/AccountSettingsSections';
import CommercialDetailPage from '@/pages/commercials/CommercialDetailPage';
import { SkeletonDetail } from '@/components/ui/Skeleton';

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ownCommercialId, setOwnCommercialId] = useState<string | null>(null);
  const [ownCommercialError, setOwnCommercialError] = useState(false);

  const isCommercial = user?.role?.name === 'commercial';

  // Fiche du commercial connecté : id résolu via l'endpoint « moi ».
  useEffect(() => {
    if (!isCommercial) return;
    let active = true;
    commercialsApi
      .myStats()
      .then((s) => {
        if (active) setOwnCommercialId(s.commercial.id);
      })
      .catch(() => {
        if (active) setOwnCommercialError(true);
      });
    return () => {
      active = false;
    };
  }, [isCommercial]);

  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

  // Commercial : /profile affiche sa fiche complète (CA, ventes, commissions,
  // prospects, services, factures, points…) ; mot de passe, 2FA et suppression
  // passent derrière le bouton Paramètres (/profile/settings).
  if (isCommercial) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('profile.title')}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {fullName} — {user.email} {user.role?.name && `— ${t(`roles.${user.role.name}`, { defaultValue: user.role.name })}`}
            </p>
          </div>
          <Link
            to="/profile/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Settings className="h-4 w-4" />
            {t('userMenu.settings')}
          </Link>
        </div>
        {ownCommercialError ? (
          <p className="text-sm text-error-500">{t('commercials.loadFailed')}</p>
        ) : ownCommercialId ? (
          <CommercialDetailPage forcedId={ownCommercialId} hideBack />
        ) : (
          <SkeletonDetail />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fullName} — {user.email} {user.role?.name && `— ${t(`roles.${user.role.name}`, { defaultValue: user.role.name })}`}
        </p>
      </div>

      <AccountSettingsSections />
    </div>
  );
}
