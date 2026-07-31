import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { TwoFactorSettings } from '@/components/profile/TwoFactorSettings';
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection';

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{t('profile.title')}</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {fullName} — {user.email} {user.role?.name && `— ${t(`roles.${user.role.name}`, { defaultValue: user.role.name })}`}
        </p>
      </div>

      <Section
        title={t('profile.changePassword')}
        description={t('profile.changePasswordDesc')}
      >
        <ChangePasswordForm />
      </Section>

      <Section title={t('profile.security')} description={t('profile.securityDesc')}>
        <TwoFactorSettings />
      </Section>

      <Section title={t('profile.dangerZone')}>
        <DeleteAccountSection />
      </Section>
    </div>
  );
}
