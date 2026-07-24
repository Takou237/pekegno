import { AuthLayout } from '@/layouts/AuthLayout';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Mot de passe oublié"
      subtitle="Indiquez votre email, nous vous enverrons un lien de réinitialisation."
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
