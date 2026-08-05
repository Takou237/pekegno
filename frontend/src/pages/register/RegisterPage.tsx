import { useTranslation } from 'react-i18next';
import { AuthLayout } from '@/layouts/AuthLayout';
import { RegisterForm } from '@/components/auth/RegisterForm';

export default function RegisterPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('register.title')} subtitle={t('register.subtitle')}>
      <RegisterForm />
    </AuthLayout>
  );
}
