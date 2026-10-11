import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChangePasswordForm } from '@/components/profile/ChangePasswordForm';
import { TwoFactorSettings } from '@/components/profile/TwoFactorSettings';
import { DeleteAccountSection } from '@/components/profile/DeleteAccountSection';

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
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

/** Mot de passe, 2FA et zone de danger : réglages du compte. */
export function AccountSettingsSections() {
  const { t } = useTranslation();

  return (
    <>
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
    </>
  );
}
