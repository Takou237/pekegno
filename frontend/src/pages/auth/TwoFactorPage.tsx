import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/layouts/AuthLayout';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';

export default function TwoFactorPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('auth.twoFactorTitle')} subtitle={t('auth.twoFactorSubtitle')}>
      <TwoFactorForm />
    </AuthLayout>
  );
}
