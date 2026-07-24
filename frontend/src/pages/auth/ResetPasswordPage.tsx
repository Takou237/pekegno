import { AuthLayout } from '@/layouts/AuthLayout';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Réinitialiser le mot de passe"
      subtitle="Choisissez un nouveau mot de passe pour votre compte."
    >
      <ResetPasswordForm />
    </AuthLayout>
  );
}
