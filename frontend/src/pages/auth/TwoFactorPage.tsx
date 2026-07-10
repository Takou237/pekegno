import { AuthLayout } from '@/layouts/AuthLayout';
import { TwoFactorForm } from '@/components/auth/TwoFactorForm';

export default function TwoFactorPage() {
  return (
    <AuthLayout
      title="Vérification en deux étapes"
      subtitle="Saisissez le code à 6 chiffres envoyé sur votre appareil."
    >
      <TwoFactorForm />
    </AuthLayout>
  );
}
